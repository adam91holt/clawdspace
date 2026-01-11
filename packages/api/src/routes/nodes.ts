import { Router, Request, Response } from 'express';
import { NodeInfo } from '../types';

const router = Router();

function parseHostsEnv(raw: string | undefined): NodeInfo[] {
  if (!raw) return [];

  // Format: name=url,name2=url2
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(entry => {
      const [name, url] = entry.split('=');
      return {
        name: (name || '').trim(),
        url: (url || '').trim(),
        status: 'offline' as const
      };
    })
    .filter(n => n.name && n.url);
}

async function fetchJson(url: string, apiKey: string, path: string): Promise<any> {
  const res = await fetch(`${url}${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// GET /nodes - list known nodes (from env)
router.get('/', async (_req: Request, res: Response) => {
  try {
    const apiKey = process.env.API_KEY || '';
    const nodes = parseHostsEnv(process.env.CLAWDSPACE_NODES);

    const results: NodeInfo[] = await Promise.all(
      nodes.map(async (n) => {
        try {
          const sys = await fetchJson(n.url, apiKey, '/api/system');
          return {
            name: n.name,
            url: n.url,
            status: 'online',
            capabilities: sys.capabilities
          };
        } catch {
          return { ...n, status: 'offline' };
        }
      })
    );

    res.json({ nodes: results });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
