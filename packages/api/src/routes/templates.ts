import { Router, Request, Response } from 'express';
import { listTemplates, getTemplateYaml, upsertTemplateFromYaml, deleteTemplate } from '../templates/store';
import { writeAudit } from '../audit';

const router = Router();

// GET /templates
router.get('/', async (_req: Request, res: Response) => {
  try {
    const templates = await listTemplates();
    res.json({ templates });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// GET /templates/:name
router.get('/:name', async (req: Request, res: Response) => {
  try {
    const yaml = await getTemplateYaml(req.params.name);
    res.json({ name: req.params.name, yaml });
  } catch (e) {
    res.status(404).json({ error: 'Template not found' });
  }
});

// PUT /templates
router.put('/', async (req: Request, res: Response) => {
  try {
    const inputYaml = String(req.body?.yaml || '');
    if (!inputYaml.trim()) return res.status(400).json({ error: 'yaml required' });

    const tpl = await upsertTemplateFromYaml(inputYaml);
    await writeAudit({ ts: new Date().toISOString(), type: 'template.upsert', meta: { template: tpl.name } });
    res.json({ template: tpl });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

// DELETE /templates/:name
router.delete('/:name', async (req: Request, res: Response) => {
  try {
    await deleteTemplate(req.params.name);
    await writeAudit({ ts: new Date().toISOString(), type: 'template.delete', meta: { template: req.params.name } });
    res.json({ message: 'OK' });
  } catch {
    res.status(404).json({ error: 'Template not found' });
  }
});

export default router;
