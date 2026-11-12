import { WebSocket, WebSocketServer } from 'ws';
import { ConfigStore } from './configStore.js';
import { logger } from '../utils/logger.js';

export function setupMonitoringWebSocket(wss: WebSocketServer, store: ConfigStore) {
  const subscriptions = new Map<WebSocket, Set<string>>();
  const lastUpdatedMap = new Map<string, number>();
  const rawStateMap = new Map<string, number>();

  let engineTimer: NodeJS.Timeout | null = null;

  const generateRealisticValue = (key: string, descr: string, units: string, scaleStr: string) => {
    const scale = Number(scaleStr) || 1;
    const lower = descr.toLowerCase();
    const u = units.toLowerCase();
    const scaleMultiplier = scale < 0.01 ? 1 / scale : 1;

    let min = 10 * scaleMultiplier;
    let max = 100 * scaleMultiplier;
    let maxStep = 15 * scaleMultiplier;

    if (lower.includes('volt') || u === 'v' || u === 'volts') {
      min = 224;
      max = 236;
      maxStep = 2.5;
    } else if (lower.includes('current') || u === 'a' || u === 'amps') {
      min = 2;
      max = 25;
      maxStep = 3.5;
    } else if (u.includes('w') || u.includes('va') || u.includes('var')) {
      min = 1.2 * scaleMultiplier;
      max = 6.5 * scaleMultiplier;
      maxStep = 1.1 * scaleMultiplier;
    }

    let currentRaw = rawStateMap.get(key);
    if (currentRaw === undefined) {
      currentRaw = min + Math.random() * (max - min);
    }

    if (u.includes('wh')) {
      currentRaw += (0.05 + Math.random() * 0.2) * scaleMultiplier;
    } else {
      const isSpike = Math.random() < 0.2;
      const stepFactor = isSpike ? 1.8 : 0.7;
      const delta = (Math.random() * 2 - 1) * maxStep * stepFactor;
      currentRaw = currentRaw + delta;

      if (currentRaw < min) currentRaw = min + Math.random() * maxStep;
      if (currentRaw > max) currentRaw = max - Math.random() * maxStep;
    }

    rawStateMap.set(key, currentRaw);
    const decimals = scale < 0.1 ? 3 : 2;
    return Number((currentRaw * scale).toFixed(decimals));
  };

  const sendInitialReadings = async (ws: WebSocket, keys: string[]) => {
    try {
      const config = await store.get();
      const now = Date.now();
      const initialBatch: Record<string, { value: number; timestamp: number }> = {};

      const findDp = (channels: any[] = [], protocol: string) => {
        for (const ch of channels) {
          if (ch.enable !== 'true') continue;
          for (const st of ch.stations || []) {
            for (const dp of st.datapoints || []) {
              const key = `${protocol}_${ch.channel_id}_${st.id}_${dp.id}`;
              if (!keys.includes(key)) continue;

              lastUpdatedMap.set(key, now);
              initialBatch[key] = {
                value: generateRealisticValue(
                  key,
                  dp.meta?.descr || '',
                  dp.meta?.units || '',
                  dp.meta?.scale || '1'
                ),
                timestamp: now,
              };
            }
          }
        }
      };

      findDp(config.modbus_tcp, 'tcp');
      findDp(config.modbus_ser, 'rtu');

      if (Object.keys(initialBatch).length > 0 && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'readings', data: initialBatch }));
      }
    } catch (err) {
      logger.error({ err }, 'Failed to send initial readings');
    }
  };

  const startEngineIfNeeded = () => {
    if (engineTimer) return;
    logger.info('Starting on-demand Modbus simulation engine');

    engineTimer = setInterval(async () => {
      const activeKeys = new Set<string>();
      subscriptions.forEach((keys) => keys.forEach((k) => activeKeys.add(k)));
      if (activeKeys.size === 0) return;

      try {
        const config = await store.get();
        const now = Date.now();
        const batchUpdates: Record<string, { value: number; timestamp: number }> = {};

        const scan = (channels: any[] = [], protocol: string) => {
          for (const ch of channels) {
            if (ch.enable !== 'true') continue;
            for (const st of ch.stations || []) {
              for (const dp of st.datapoints || []) {
                const key = `${protocol}_${ch.channel_id}_${st.id}_${dp.id}`;
                if (!activeKeys.has(key)) continue;

                // Ilgiems ciklams (pvz., 1 val.) nustatome maks. 10s lubas simuliacijai
                const rawCycle = Number(dp.acq_cycle) || 1000;
                const cycle = Math.min(Math.max(250, rawCycle), 10000);
                const lastTime = lastUpdatedMap.get(key) || 0;

                if (now - lastTime >= cycle - 20) {
                  lastUpdatedMap.set(key, now);
                  batchUpdates[key] = {
                    value: generateRealisticValue(
                      key,
                      dp.meta?.descr || '',
                      dp.meta?.units || '',
                      dp.meta?.scale || '1'
                    ),
                    timestamp: now,
                  };
                }
              }
            }
          }
        };

        scan(config.modbus_tcp, 'tcp');
        scan(config.modbus_ser, 'rtu');

        if (Object.keys(batchUpdates).length === 0) return;

        subscriptions.forEach((clientKeys, ws) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const clientPayload: Record<string, { value: number; timestamp: number }> = {};
          let hasData = false;

          clientKeys.forEach((k) => {
            if (batchUpdates[k]) {
              clientPayload[k] = batchUpdates[k];
              hasData = true;
            }
          });

          if (hasData) {
            ws.send(JSON.stringify({ type: 'readings', data: clientPayload }));
          }
        });
      } catch (err) {
        logger.error({ err }, 'Simulation engine tick error');
      }
    }, 250);
  };

  const stopEngineIfIdle = () => {
    if (subscriptions.size === 0 && engineTimer) {
      clearInterval(engineTimer);
      engineTimer = null;
      lastUpdatedMap.clear();
      logger.info('Stopped Modbus simulation engine (no active clients)');
    }
  };

  wss.on('connection', (ws) => {
    subscriptions.set(ws, new Set());
    startEngineIfNeeded();

    ws.on('message', (rawMsg) => {
      try {
        const msg = JSON.parse(rawMsg.toString());
        if (msg.type === 'subscribe' && Array.isArray(msg.keys)) {
          const prevKeys = subscriptions.get(ws) || new Set();
          const newlyAdded = msg.keys.filter((k: string) => !prevKeys.has(k));
          subscriptions.set(ws, new Set(msg.keys));

          if (newlyAdded.length > 0) {
            sendInitialReadings(ws, newlyAdded);
          }
        }
      } catch {
        // Ignoruojame
      }
    });

    ws.on('close', () => {
      subscriptions.delete(ws);
      stopEngineIfIdle();
    });
  });
}
