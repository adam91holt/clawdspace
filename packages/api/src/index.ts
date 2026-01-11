import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import expressWs from 'express-ws';
import spacesRouter from './routes/spaces';
import systemRouter from './routes/system';
import nodesRouter from './routes/nodes';
import auditRouter from './routes/audit';
import { startAutoSleepWorker } from './docker';
import { startTerminalSession } from './terminal';
import { startNodesCacheWorker } from './nodesCache';

const appBase = express();
const wsInstance = expressWs(appBase);
const app = wsInstance.app;

const PORT = parseInt(process.env.PORT || '7777');
const API_KEY = process.env.API_KEY || 'clawdspace_dev_key';
const IDLE_TIMEOUT_MS = parseInt(process.env.IDLE_TIMEOUT_MS || String(10 * 60 * 1000));

// Middleware
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Serve static files (React build)
app.use(express.static(path.join(__dirname, '../../web/dist')));

// Auth middleware
const auth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const apiKey = req.query.key as string | undefined;

  if (authHeader === `Bearer ${API_KEY}` || apiKey === API_KEY) {
    return next();
  }

  // Allow dashboard access without auth
  if (req.method === 'GET' && !req.path.startsWith('/api/')) {
    return next();
  }

  res.status(401).json({ error: 'Unauthorized' });
};

function isWsAuthed(req: Request): boolean {
  const authHeader = req.headers.authorization;
  const apiKey = req.query.key as string | undefined;
  return authHeader === `Bearer ${API_KEY}` || apiKey === API_KEY;
}

// API routes
app.use('/api/spaces', auth, spacesRouter);
app.use('/api/system', auth, systemRouter);
app.use('/api/nodes', auth, nodesRouter);
app.use('/api/audit', auth, auditRouter);

// Terminal websocket (admin)
app.ws('/api/spaces/:name/terminal', async (ws, req) => {
  try {
    if (!isWsAuthed(req)) {
      ws.close();
      return;
    }

    await startTerminalSession({
      name: req.params.name,
      ws
    });
  } catch {
    try {
      ws.close();
    } catch {
      // ignore
    }
  }
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.5.0' });
});

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../../web/dist/index.html'));
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

// Start auto-sleep worker
startAutoSleepWorker(IDLE_TIMEOUT_MS);

// Start nodes discovery/health cache worker
startNodesCacheWorker(parseInt(process.env.NODES_REFRESH_MS || '30000'));

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                      CLAWDSPACE                            ║
║              Self-hosted Sandboxed Environments            ║
╠═══════════════════════════════════════════════════════════╣
║  API:        http://0.0.0.0:${PORT}/api                     ║
║  Dashboard:  http://0.0.0.0:${PORT}/                        ║
║  API Key:    ${API_KEY.substring(0, 20)}...                  ║
║  Idle:       ${IDLE_TIMEOUT_MS / 1000 / 60} minutes → auto-sleep              ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

export default app;
