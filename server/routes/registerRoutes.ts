import { Router } from 'express';
import { ConfigStore } from '../services/configStore.js';
import { logger } from '../utils/logger.js';

export function createRegisterRoutes(store: ConfigStore) {
  const router = Router();

  router.post('/bulk-delete', async (req, res) => {
    try {
      const items: { protocol: string; channelId: string; deviceId: string; registerId: string }[] =
        req.body.items || [];
      const draftConfig = structuredClone(await store.get());

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

  return router;
}
