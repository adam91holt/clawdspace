import { exec } from 'child_process';
import { promisify } from 'util';
import { NodeInfo } from './types';

const execAsync = promisify(exec);

type NodeTarget = { name: string; url: string };

type CacheState = {
  nodes: NodeInfo[];
  lastUpdatedAt: number;
};

const cache: CacheState = {
  nodes: [],
  lastUpdatedAt: 0
};

function parseHostsEnv(raw: string | undefined): NodeTarget[] {
  if (!raw) return [];
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

async function tailscalePeers(): Promise<NodeTarget[]> {
  try {
    const { stdout } = await execAsync('tailscale status --json', { timeout: 4000 });
    const data = JSON.parse(stdout);

    const self = data.Self;
    const selfName = (self?.HostName || self?.DNSName || 'self') as string;

    const peersObj = (data.Peer || {}) as Record<string, any>;
    const peers = Object.values(peersObj);

    const out: NodeTarget[] = [];

    out.push({ name: selfName.replace(/\.$/, ''), url: 'http://localhost:7777' });

    for (const p of peers) {
      if (!p || p.Online !== true) continue;

      const dnsName = (p.DNSName || '').toString().replace(/\.$/, '');
      const hostName = (p.HostName || '').toString();
      const name = (hostName || dnsName || p.ID || 'peer').toString();

      const host = dnsName || hostName;
      if (!host) continue;

      out.push({ name, url: `http://${host}:7777` });
    }

    const seen = new Set<string>();
    return out.filter(n => (seen.has(n.url) ? false : (seen.add(n.url), true)));
  } catch {
    return [];
  }
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

async function resolveTargets(): Promise<NodeTarget[]> {
  const env = parseHostsEnv(process.env.CLAWDSPACE_NODES);
  if (env.length) return env;
  return tailscalePeers();
}

export function getNodesCache(): CacheState {
  return cache;
}

export async function refreshNodesCache(): Promise<void> {
  const apiKey = process.env.API_KEY || '';
  const targets = await resolveTargets();

  const results: NodeInfo[] = await Promise.all(
    targets.map(async (t) => {
      const start = Date.now();
      try {
        const sys = await fetchJson(t.url, apiKey, '/api/system');
        return {
          name: t.name,
          url: t.url,
          status: 'online',
          latencyMs: Date.now() - start,
          capabilities: sys.capabilities
        } satisfies NodeInfo;
      } catch {
        return {
          name: t.name,
          url: t.url,
          status: 'offline',
          latencyMs: Date.now() - start
        } satisfies NodeInfo;
      }
    })
  );

  cache.nodes = results;
  cache.lastUpdatedAt = Date.now();
}

export function startNodesCacheWorker(intervalMs: number = 30000): NodeJS.Timeout {
  // Kick once, then interval.
  refreshNodesCache().catch(() => {});
  return setInterval(() => {
    refreshNodesCache().catch(() => {});
  }, intervalMs);
}
