import { Router } from 'express';
import { ConfigStore } from '../services/configStore.js';
import { logger } from '../utils/logger.js';
import { validateModbusConfig } from '../utils/validator.js';

export function createConfigRoutes(store: ConfigStore) {
  const router = Router();

  router.get('/', async (_req, res) => {
    try {
      const config = await store.get();
      res.json(config);
    } catch (error) {
      logger.error({ err: error }, 'Failed to read configuration');
      res.status(500).json({ error: 'Failed to read configuration' });
    }
  });

  router.put('/', async (req, res) => {
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

  return router;
}
