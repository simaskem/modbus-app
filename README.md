# Modbus App

Full-stack Node.js and React application built for embedded Linux devices.

## Overview
- Uses native `npm workspaces` (`server` and `client`) to avoid extra monorepo tooling.
- In production, the Express server serves the built React frontend directly from `client/dist` to keep memory usage low.

## Structure
- `client/` - React + TypeScript + Vite frontend
- `server/` - Node.js + Express + TypeScript backend

## Setup & Run

### Quick Start
```bash
npm install && npm run build && npm start
```
The app runs on `http://localhost:8000` (override with `PORT` env variable if needed).

### Individual Commands
- `npm install` - Install dependencies
- `npm run build` - Build server and client for production
- `npm start` - Start production server (`NODE_ENV=production`)
- `npm run dev` - Run server and client in development mode

### Embedded Device Deployment
To install only runtime dependencies on the target device without dev tools (TypeScript, Vite, etc.):
```bash
npm ci --omit=dev
npm start
```

## Configuration
- Modbus settings are stored in `server/modbus_config.json` and served via `GET /api/config`.
