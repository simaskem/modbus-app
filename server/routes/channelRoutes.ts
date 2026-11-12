import { Router } from 'express';
import { ConfigStore } from '../services/configStore.js';
import { logger } from '../utils/logger.js';
import { validateModbusConfig } from '../utils/validator.js';

export function createChannelRoutes(store: ConfigStore) {
  const router = Router();

  // Atnaujinti kanalo nustatymus
  router.patch('/:protocol/:channelId', async (req, res) => {
    try {
      const { protocol, channelId } = req.params;
      const draftConfig = structuredClone(await store.get());

      const channel = store.findChannel(draftConfig, protocol, channelId);
      if (!channel) return res.status(404).json({ error: 'Channel not found' });

      Object.assign(channel, req.body);

      const validationError = validateModbusConfig(draftConfig);
      if (validationError) return res.status(400).json({ error: validationError });

      await store.save(draftConfig);
      res.json(channel);
    } catch (error) {
      logger.error({ err: error }, 'Failed to update channel');
      res.status(500).json({ error: 'Failed to update channel' });
    }
  });

  // Sukurti naują įrenginį (station)
  router.post('/:protocol/:channelId/devices', async (req, res) => {
    try {
      const { protocol, channelId } = req.params;
      const draftConfig = structuredClone(await store.get());

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
      if (validationError) return res.status(400).json({ error: validationError });

      await store.save(draftConfig);
      res.status(201).json(newDevice);
    } catch (error) {
      logger.error({ err: error }, 'Failed to create device');
      res.status(500).json({ error: 'Failed to create device' });
    }
  });

  // Ištrinti įrenginį (station)
  router.delete('/:protocol/:channelId/devices/:deviceId', async (req, res) => {
    try {
      const { protocol, channelId, deviceId } = req.params;
      const draftConfig = structuredClone(await store.get());

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

  // Pridėti naują registrą į įrenginį
  router.post('/:protocol/:channelId/devices/:deviceId/registers', async (req, res) => {
    try {
      const { protocol, channelId, deviceId } = req.params;
      const draftConfig = structuredClone(await store.get());

      const channel = store.findChannel(draftConfig, protocol, channelId);
      const device = channel?.stations.find((s: any) => s.id === deviceId);
      if (!device) return res.status(404).json({ error: 'Device not found' });

      device.datapoints.push(req.body);

      const validationError = validateModbusConfig(draftConfig);
      if (validationError) return res.status(400).json({ error: validationError });

      await store.save(draftConfig);
      res.status(201).json(req.body);
    } catch (error) {
      logger.error({ err: error }, 'Failed to add register');
      res.status(500).json({ error: 'Failed to add register' });
    }
  });

  return router;
}
