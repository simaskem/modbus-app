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

// Prijungiame išskaidytus maršrutus
app.use('/api/config', createConfigRoutes(store));
app.use('/api/channels', createChannelRoutes(store));
app.use('/api/registers', createRegisterRoutes(store));

// Produkcijos režime atiduodame sukompiliuotą React aplikaciją
if (process.env.NODE_ENV === 'production') {
  const clientDistPath = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDistPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Bendras HTTP ir WebSocket serveris ant to paties prievado
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
setupMonitoringWebSocket(wss, store);

server.listen(PORT, () => {
  logger.info(`Server & WebSocket running on http://localhost:${PORT}`);
});
