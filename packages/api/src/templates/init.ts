import fs from 'fs/promises';
import path from 'path';
import { defaultTemplates, serializeTemplate } from './defaults';

const TEMPLATES_DIR = process.env.CLAWDSPACE_TEMPLATES_DIR || path.join(process.cwd(), 'data', 'templates');

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDefaultTemplates(): Promise<void> {
  await fs.mkdir(TEMPLATES_DIR, { recursive: true });

  for (const t of defaultTemplates()) {
    const p = path.join(TEMPLATES_DIR, `${t.name}.yaml`);

    // Managed templates: always overwrite on boot so code changes take effect.
    if (t.managed) {
      await fs.writeFile(p, serializeTemplate(t), { encoding: 'utf8' });
      continue;
    }

    if (await fileExists(p)) continue;
    await fs.writeFile(p, serializeTemplate(t), { encoding: 'utf8' });
  }
}
