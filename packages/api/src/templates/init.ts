import fs from 'fs/promises';
import path from 'path';
import { defaultTemplates, serializeTemplate } from './defaults';

const TEMPLATES_DIR = process.env.CLAWDSPACE_TEMPLATES_DIR || path.join(process.cwd(), 'data', 'templates');

export async function ensureDefaultTemplates(): Promise<void> {
  await fs.mkdir(TEMPLATES_DIR, { recursive: true });

  const existing = new Set<string>();
  try {
    const entries = await fs.readdir(TEMPLATES_DIR);
    for (const e of entries) {
      if (e.endsWith('.yaml') || e.endsWith('.yml')) {
        existing.add(e.replace(/\.(yaml|yml)$/i, ''));
      }
    }
  } catch {
    // ignore
  }

  for (const t of defaultTemplates()) {
    if (existing.has(t.name)) continue;
    const p = path.join(TEMPLATES_DIR, `${t.name}.yaml`);
    await fs.writeFile(p, serializeTemplate(t), { encoding: 'utf8' });
  }
}
