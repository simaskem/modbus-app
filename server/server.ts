import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './logger.js';
import { ConfigStore } from './configStore.js';
import { validateModbusConfig } from './validator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json({ limit: '5mb' }));

const serverRoot = path.basename(__dirname) === 'dist' ? path.resolve(__dirname, '..') : __dirname;
const store = new ConfigStore(path.join(serverRoot, 'modbus_config.json'));

// 1. READ: Gauti visą konfigūraciją
app.get('/api/config', async (_req, res) => {
  try {
    const config = await store.get();
    res.json(config);
  } catch (error) {
    logger.error({ err: error }, 'Failed to read configuration');
    res.status(500).json({ error: 'Failed to read configuration' });
  }
});

// 2. SAVE / BULK IMPORT: Išsaugoti visą arba importuotą konfigūraciją
app.put('/api/config', async (req, res) => {
  try {
    const newConfig = req.body;
    const validationError = validateModbusConfig(newConfig);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    await store.save(newConfig);
    logger.info('Configuration saved persistently');
    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Failed to save configuration');
    res.status(500).json({ error: 'Failed to save configuration' });
  }
});

// 3. UPDATE CHANNEL: Atnaujinti kanalo ryšio nustatymus (TCP / RTU)
app.patch('/api/channels/:protocol/:channelId', async (req, res) => {
  try {
    const { protocol, channelId } = req.params;
    const currentConfig = await store.get();
    const draftConfig = structuredClone(currentConfig);

    const channel = store.findChannel(draftConfig, protocol, channelId);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });

    Object.assign(channel, req.body);

    const validationError = validateModbusConfig(draftConfig);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    await store.save(draftConfig);
    res.json(channel);
  } catch (error) {
    logger.error({ err: error }, 'Failed to update channel');
    res.status(500).json({ error: 'Failed to update channel' });
  }
});

// 4. CREATE DEVICE (Station): Pridėti naują įrenginį į kanalą
app.post('/api/channels/:protocol/:channelId/devices', async (req, res) => {
  try {
    const { protocol, channelId } = req.params;
    const currentConfig = await store.get();
    const draftConfig = structuredClone(currentConfig);

    const channel = store.findChannel(draftConfig, protocol, channelId);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });

    const newDevice = {
      id: req.body.id || String(Date.now()),
      station_addr: req.body.station_addr || '1',
      name: req.body.name || 'New Modbus Device',
      datapoints: req.body.datapoints || [],
    };
    channel.stations.push(newDevice);

    const validationError = validateModbusConfig(draftConfig);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    await store.save(draftConfig);
    res.status(201).json(newDevice);
  } catch (error) {
    logger.error({ err: error }, 'Failed to create device');
    res.status(500).json({ error: 'Failed to create device' });
  }
});

// 5. DELETE DEVICE (Station): Ištrinti įrenginį
app.delete('/api/channels/:protocol/:channelId/devices/:deviceId', async (req, res) => {
  try {
    const { protocol, channelId, deviceId } = req.params;
    const currentConfig = await store.get();
    const draftConfig = structuredClone(currentConfig);

    const channel = store.findChannel(draftConfig, protocol, channelId);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });

    channel.stations = channel.stations.filter((s: any) => s.id !== deviceId);

    await store.save(draftConfig);
    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Failed to delete device');
    res.status(500).json({ error: 'Failed to delete device' });
  }
});

// 6. MANAGE REGISTERS: Pridėti naują registrą į įrenginį
app.post('/api/channels/:protocol/:channelId/devices/:deviceId/registers', async (req, res) => {
  try {
    const { protocol, channelId, deviceId } = req.params;
    const currentConfig = await store.get();
    const draftConfig = structuredClone(currentConfig);

    const channel = store.findChannel(draftConfig, protocol, channelId);
    const device = channel?.stations.find((s: any) => s.id === deviceId);
    if (!device) return res.status(404).json({ error: 'Device not found' });

    device.datapoints.push(req.body);

    const validationError = validateModbusConfig(draftConfig);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    await store.save(draftConfig);
    res.status(201).json(req.body);
  } catch (error) {
    logger.error({ err: error }, 'Failed to add register');
    res.status(500).json({ error: 'Failed to add register' });
  }
});

// 7. BULK DELETE REGISTERS: Masinis registrų trynimas
app.post('/api/registers/bulk-delete', async (req, res) => {
  try {
    const items: { protocol: string; channelId: string; deviceId: string; registerId: string }[] =
      req.body.items || [];
    const currentConfig = await store.get();
    const draftConfig = structuredClone(currentConfig);

    for (const item of items) {
      const ch = store.findChannel(draftConfig, item.protocol, item.channelId);
      const st = ch?.stations.find((s: any) => s.id === item.deviceId);
      if (st) {
        st.datapoints = st.datapoints.filter((dp: any) => dp.id !== item.registerId);
      }
    }

    await store.save(draftConfig);
    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Failed to bulk delete registers');
    res.status(500).json({ error: 'Failed to bulk delete registers' });
  }
});

// Produkcijos režime atiduodame sukompiliuotą React aplikaciją
if (process.env.NODE_ENV === 'production') {
  const clientDistPath = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDistPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
});
