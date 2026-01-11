import { Router, Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import { NodeInfo } from '../types';

const router = Router();
const execAsync = promisify(exec);

function parseHostsEnv(raw: string | undefined): Array<{ name: string; url: string }> {
  if (!raw) return [];

  // Format: name=url,name2=url2
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(entry => {
      const [name, url] = entry.split('=');
      return { name: (name || '').trim(), url: (url || '').trim() };
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

async function tailscalePeers(): Promise<Array<{ name: string; baseUrl: string }>> {
  try {
    const { stdout } = await execAsync('tailscale status --json', { timeout: 4000 });
    const data = JSON.parse(stdout);

    const self = data.Self;
    const selfName = (self?.HostName || self?.DNSName || 'self') as string;

    const peersObj = (data.Peer || {}) as Record<string, any>;
    const peers = Object.values(peersObj);

    const out: Array<{ name: string; baseUrl: string }> = [];

    // include self as localhost (from the perspective of this node)
    out.push({ name: selfName.replace(/\.$/, ''), baseUrl: 'http://localhost:7777' });

    for (const p of peers) {
      if (!p || p.Online !== true) continue;

      const dnsName = (p.DNSName || '').toString().replace(/\.$/, '');
      const hostName = (p.HostName || '').toString();

      const name = (hostName || dnsName || p.ID || 'peer').toString();

      // Use DNSName when available: tailscale magic DNS
      const host = dnsName || hostName;
      if (!host) continue;

      out.push({ name, baseUrl: `http://${host}:7777` });
    }

    // de-dupe by baseUrl
    const seen = new Set<string>();
    return out.filter(n => (seen.has(n.baseUrl) ? false : (seen.add(n.baseUrl), true)));
  } catch {
    return [];
  }
}

async function resolveNodes(): Promise<Array<{ name: string; url: string }>> {
  // Priority:
  // 1) Explicit env var
  // 2) Tailscale autodiscovery
  const env = parseHostsEnv(process.env.CLAWDSPACE_NODES);
  if (env.length) return env;

  const peers = await tailscalePeers();
  return peers.map(p => ({ name: p.name, url: p.baseUrl }));
}

// GET /nodes - list known nodes
router.get('/', async (_req: Request, res: Response) => {
  try {
    const apiKey = process.env.API_KEY || '';
    const nodes = await resolveNodes();

    const results: NodeInfo[] = await Promise.all(
      nodes.map(async (n) => {
        const start = Date.now();
        try {
          const sys = await fetchJson(n.url, apiKey, '/api/system');
          const latencyMs = Date.now() - start;
          return {
            name: n.name,
            url: n.url,
            status: 'online',
            latencyMs,
            capabilities: sys.capabilities
          };
        } catch {
          const latencyMs = Date.now() - start;
          return { ...n, status: 'offline', latencyMs };
        }
      })
    );

    res.json({ nodes: results });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
