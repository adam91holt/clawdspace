import fs from 'fs/promises';
import path from 'path';

export type AuditEvent = {
  ts: string;
  space?: string;
  type:
    | 'space.create'
    | 'space.start'
    | 'space.pause'
    | 'space.destroy'
    | 'space.exec'
    | 'space.shell'
    | 'space.file.write'
    | 'terminal.open'
    | 'terminal.close';
  meta?: Record<string, unknown>;
};

const AUDIT_PATH = process.env.CLAWDSPACE_AUDIT_PATH || path.join(process.cwd(), 'data', 'audit.jsonl');

async function ensureDir(): Promise<void> {
  await fs.mkdir(path.dirname(AUDIT_PATH), { recursive: true });
}

export async function writeAudit(event: AuditEvent): Promise<void> {
  try {
    await ensureDir();
    const line = JSON.stringify(event) + '\n';
    await fs.appendFile(AUDIT_PATH, line, { encoding: 'utf8' });
  } catch {
    // best effort
  }
}

export async function readAudit({
  space,
  limit
}: {
  space?: string;
  limit: number;
}): Promise<AuditEvent[]> {
  await ensureDir();

  let raw = '';
  try {
    raw = await fs.readFile(AUDIT_PATH, 'utf8');
  } catch {
    return [];
  }

  const lines = raw.trim().split('\n').filter(Boolean);
  const maxScan = Math.min(lines.length, 5000);

  const out: AuditEvent[] = [];
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - maxScan); i--) {
    try {
      const e = JSON.parse(lines[i]) as AuditEvent;
      if (space && e.space !== space) continue;
      out.push(e);
      if (out.length >= limit) break;
    } catch {
      continue;
    }
  }

  return out.reverse();
}
