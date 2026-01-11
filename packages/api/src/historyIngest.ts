import Docker from 'dockerode';
import { writeAudit } from './audit';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

const PREFIX = 'clawdspace-';
const VOLUME_PREFIX = 'clawdspace-vol-';

type CursorState = {
  lastSize: number;
  lastLine?: string;
};

const cursors = new Map<string, CursorState>();

function volumeName(spaceName: string): string {
  return `${VOLUME_PREFIX}${spaceName}`;
}

function toSpaceName(containerName: string): string {
  return containerName.replace(`/${PREFIX}`, '');
}

function parseHistoryLines(raw: string): Array<{ ts?: string; command: string }> {
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  return lines.map(l => {
    // If HISTTIMEFORMAT is set to '%s ' the line starts with "<epoch> "
    const m = l.match(/^(\d{9,12})\s+(.*)$/);
    if (m) return { ts: new Date(parseInt(m[1], 10) * 1000).toISOString(), command: m[2] };
    return { command: l };
  });
}

async function readHistoryFromVolume(spaceName: string, maxBytes: number = 200_000): Promise<string> {
  const vol = volumeName(spaceName);

  const helperName = `${PREFIX}${spaceName}-history-read-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const cmd = [
    'sh',
    '-lc',
    [
      'set -e',
      'if [ ! -f /workspace/.bash_history ]; then exit 0; fi',
      "python3 - <<'PY'\nimport sys\npath='/workspace/.bash_history'\nmaxb=%d\nwith open(path,'rb') as f:\n  b=f.read(maxb)\nprint(b.decode('utf-8','ignore'))\nPY" .replace('%d', String(maxBytes))
    ].join(' && ')
  ];

  const c = await docker.createContainer({
    Image: process.env.CLAWDSPACE_IMAGE || 'clawdspace:latest',
    name: helperName,
    User: 'root',
    HostConfig: {
      NetworkMode: 'none',
      Mounts: [{ Type: 'volume', Source: vol, Target: '/workspace', ReadOnly: true }]
    },
    Cmd: cmd,
    Labels: { 'clawdspace.kind': 'history-read', 'clawdspace.space': spaceName }
  });

  await c.start();
  await c.wait();

  let out = '';
  try {
    const logs = await c.logs({ stdout: true, stderr: true });
    out = Buffer.isBuffer(logs) ? logs.toString('utf8') : String(logs);
  } catch {
    // ignore
  }

  try {
    await c.remove({ force: true });
  } catch {
    // ignore
  }

  return out;
}

async function ingestSpaceHistory(spaceName: string): Promise<void> {
  const raw = await readHistoryFromVolume(spaceName);
  if (!raw.trim()) return;

  const cursor = cursors.get(spaceName) || { lastSize: 0 };

  const size = raw.length;
  const tailSig = raw.slice(-200);
  if (size === cursor.lastSize && tailSig === (cursor.lastLine || '')) {
    return;
  }

  const lines = parseHistoryLines(raw);
  const tail = lines.slice(-200);

  let startIdx = 0;
  if (cursor.lastLine) {
    const idx = tail.findIndex(x => `${x.ts || ''}${x.command}` === cursor.lastLine);
    if (idx >= 0) startIdx = idx + 1;
  }

  for (const entry of tail.slice(startIdx)) {
    await writeAudit({
      ts: entry.ts || new Date().toISOString(),
      space: spaceName,
      type: 'space.shell',
      meta: { command: entry.command, source: 'bash_history' }
    });
  }

  const last = tail[tail.length - 1];
  cursors.set(spaceName, {
    lastSize: size,
    lastLine: last ? `${last.ts || ''}${last.command}` : cursor.lastLine
  });
}

export function startHistoryIngestWorker(intervalMs: number = 15000): NodeJS.Timeout {
  const tick = async () => {
    try {
      const containers = await docker.listContainers({ all: true });
      const spaces = containers
        .filter(c => c.Names.some(n => n.startsWith(`/${PREFIX}`)))
        .map(c => toSpaceName(c.Names[0]));

      for (const name of spaces) {
        await ingestSpaceHistory(name);
      }
    } catch {
      // ignore
    }
  };

  tick().catch(() => {});
  return setInterval(() => tick().catch(() => {}), intervalMs);
}
