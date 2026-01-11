import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { SpaceTemplateSchema, SpaceTemplate } from './schema';

const TEMPLATES_DIR = process.env.CLAWDSPACE_TEMPLATES_DIR || path.join(process.cwd(), 'data', 'templates');

async function ensureDir(): Promise<void> {
  await fs.mkdir(TEMPLATES_DIR, { recursive: true });
}

function fileForName(name: string): string {
  return path.join(TEMPLATES_DIR, `${name}.yaml`);
}

export async function listTemplates(): Promise<Array<{ name: string; description?: string }>> {
  await ensureDir();
  const entries = await fs.readdir(TEMPLATES_DIR, { withFileTypes: true });
  const out: Array<{ name: string; description?: string }> = [];

  for (const e of entries) {
    if (!e.isFile()) continue;
    if (!e.name.endsWith('.yaml') && !e.name.endsWith('.yml')) continue;
    const p = path.join(TEMPLATES_DIR, e.name);
    try {
      const raw = await fs.readFile(p, 'utf8');
      const doc = yaml.load(raw);
      const parsed = SpaceTemplateSchema.safeParse(doc);
      if (!parsed.success) continue;
      out.push({ name: parsed.data.name, description: parsed.data.description || '' });
    } catch {
      continue;
    }
  }

  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getTemplateYaml(name: string): Promise<string> {
  await ensureDir();
  const p = fileForName(name);
  return fs.readFile(p, 'utf8');
}

export async function getTemplate(name: string): Promise<SpaceTemplate> {
  const raw = await getTemplateYaml(name);
  const doc = yaml.load(raw);
  return SpaceTemplateSchema.parse(doc);
}

export async function upsertTemplateFromYaml(inputYaml: string): Promise<SpaceTemplate> {
  await ensureDir();
  const doc = yaml.load(inputYaml);
  const parsed = SpaceTemplateSchema.parse(doc);
  const p = fileForName(parsed.name);
  await fs.writeFile(p, yaml.dump(parsed, { sortKeys: false }), { encoding: 'utf8' });
  return parsed;
}

export async function deleteTemplate(name: string): Promise<void> {
  await ensureDir();
  const p = fileForName(name);
  await fs.unlink(p);
}
