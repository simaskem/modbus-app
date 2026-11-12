import { useEffect, useRef, useState } from 'react';
import { NormalizedState } from '../types/modbus';

export interface TimeSeriesPoint {
  timestamp: number;
  value: number;
}

export function useDeviceMonitoring(
  state: NormalizedState | null,
  isActive: boolean,
  subscribedDpUids: string[],
  timeRangeMinutes: number
) {
  const [latestValues, setLatestValues] = useState<Record<string, number>>({});
  const [history, setHistory] = useState<Record<string, TimeSeriesPoint[]>>({});
  const [isConnected, setIsConnected] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const keyToUidMapRef = useRef<Record<string, string>>({});
  const timeRangeRef = useRef<number>(timeRangeMinutes);

  // Sinchronizuojame laiko lango ref ir išvalome pasenusius taškus
  useEffect(() => {
    timeRangeRef.current = timeRangeMinutes;
    const cutoffSec = Date.now() / 1000 - timeRangeMinutes * 60;
    setHistory((prev) => {
      const next: Record<string, TimeSeriesPoint[]> = {};
      Object.entries(prev).forEach(([uid, pts]) => {
        next[uid] = pts.filter((p) => p.timestamp >= cutoffSec);
      });
      return next;
    });
  }, [timeRangeMinutes]);

  // Valdome WebSocket ryšį: aktyvus TIK kai esame Monitoring lange IR yra pažymėtas bent 1 registras
  const hasSubscriptions = subscribedDpUids.length > 0;

  useEffect(() => {
    if (!isActive || !hasSubscriptions) {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      setIsConnected(false);
      setHistory({});
      setLatestValues({});
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      if (state && subscribedDpUids.length > 0) {
        sendSubscription(ws, state, subscribedDpUids, keyToUidMapRef.current);
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'readings' && msg.data) {
          const batch: Record<string, { value: number; timestamp: number }> = msg.data;
          const nextLatest: Record<string, number> = {};
          const incomingByUid: Record<string, TimeSeriesPoint> = {};

          Object.entries(batch).forEach(([serverKey, reading]) => {
            const dpUid = keyToUidMapRef.current[serverKey];
            if (dpUid) {
              nextLatest[dpUid] = reading.value;
              incomingByUid[dpUid] = {
                timestamp: reading.timestamp / 1000,
                value: reading.value,
              };
            }
          });

          setLatestValues((prev) => ({ ...prev, ...nextLatest }));

          const cutoffSec = Date.now() / 1000 - timeRangeRef.current * 60;
          setHistory((prev) => {
            const next = { ...prev };
            Object.entries(incomingByUid).forEach(([uid, point]) => {
              const existing = next[uid] || [];
              const filtered = existing.filter((p) => p.timestamp >= cutoffSec);
              filtered.push(point);
              next[uid] = filtered;
            });
            return next;
          });
        }
      } catch {
        // Ignoruojame
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    return () => {
      ws.close();
      socketRef.current = null;
    };
  }, [isActive, hasSubscriptions]);

  // Kai pažymime/atžymime registrus esant atviram ryšiui
  useEffect(() => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !state) return;

    sendSubscription(ws, state, subscribedDpUids, keyToUidMapRef.current);

    // Išvalome nužymėtų registrų istoriją iš atminties
    setHistory((prev) => {
      const next: Record<string, TimeSeriesPoint[]> = {};
      subscribedDpUids.forEach((uid) => {
        if (prev[uid]) next[uid] = prev[uid];
      });
      return next;
    });
  }, [subscribedDpUids, state]);

  return { latestValues, history, isConnected };
}

function sendSubscription(
  ws: WebSocket,
  state: NormalizedState,
  dpUids: string[],
  keyMap: Record<string, string>
) {
  const keys: string[] = [];
  dpUids.forEach((uid) => {
    const dp = state.datapoints[uid];
    const st = dp ? state.stations[dp.stationUid] : null;
    const ch = st ? state.channels[st.channelUid] : null;
    if (!dp || !st || !ch) return;

    const serverKey = `${ch.protocol}_${ch.channel_id}_${st.id}_${dp.id}`;
    keyMap[serverKey] = uid;
    keys.push(serverKey);
  });

  ws.send(JSON.stringify({ type: 'subscribe', keys }));
}
