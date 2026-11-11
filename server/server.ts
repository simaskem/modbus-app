import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

// tsx runs this file from server/; production runs dist/server.js one level deeper.
const serverRoot = path.basename(__dirname) === 'dist' ? path.resolve(__dirname, '..') : __dirname;
const configPath = path.join(serverRoot, 'modbus_config.json');

// GET endpoint to read configuration
app.get('/api/config', async (req, res) => {
  try {
    const rawData = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(rawData);
    res.json(config);
  } catch (error) {
    logger.error({ err: error }, 'Failed to read configuration');
    res.status(500).json({ error: 'Failed to read configuration' });
  }
});

// Serve built React frontend in production
if (process.env.NODE_ENV === 'production') {
  const clientDistPath = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDistPath));

  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
});