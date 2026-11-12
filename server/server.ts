import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { logger } from './utils/logger.js';
import { ConfigStore } from './services/configStore.js';
import { setupMonitoringWebSocket } from './services/simulator.js';
import { createConfigRoutes } from './routes/configRoutes.js';
import { createChannelRoutes } from './routes/channelRoutes.js';
import { createRegisterRoutes } from './routes/registerRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json({ limit: '5mb' }));

const serverRoot = path.basename(__dirname) === 'dist' ? path.resolve(__dirname, '..') : __dirname;
const store = new ConfigStore(path.join(serverRoot, 'modbus_config.json'));

app.use('/api/config', createConfigRoutes(store));
app.use('/api/channels', createChannelRoutes(store));
app.use('/api/registers', createRegisterRoutes(store));

if (process.env.NODE_ENV === 'production') {
  const clientDistPath = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDistPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
setupMonitoringWebSocket(wss, store);

server.listen(PORT, () => {
  logger.info(`Server & WebSocket running on http://localhost:${PORT}`);
});

// Saugus serverio sustabdymas: prieš išjungiant įrašome atidėtus pakeitimus į diską
const handleShutdown = async () => {
  logger.info('Shutting down server, flushing pending config changes...');
  await store.flushToDisk();
  process.exit(0);
};

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);
