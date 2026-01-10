import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import spacesRouter from './routes/spaces';
import systemRouter from './routes/system';
import { startAutoSleepWorker } from './docker';

const app = express();

const PORT = parseInt(process.env.PORT || '7777');
const API_KEY = process.env.API_KEY || 'clawdspace_dev_key';
const IDLE_TIMEOUT_MS = parseInt(process.env.IDLE_TIMEOUT_MS || String(10 * 60 * 1000));

// Middleware
app.use(cors());
app.use(express.json());

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

// API routes
app.use('/api/spaces', auth, spacesRouter);
app.use('/api/system', auth, systemRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
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
