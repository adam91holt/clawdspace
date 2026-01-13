import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

vi.mock('../src/templates/store', () => {
  return {
    listTemplates: vi.fn(async () => [
      { name: 'default', description: 'Default' },
      { name: 'offline', description: 'Offline' }
    ]),
    getTemplateYaml: vi.fn(async (name: string) => `name: ${name}\n`),
    upsertTemplateFromYaml: vi.fn(async () => ({ name: 'from-yaml' })),
    deleteTemplate: vi.fn(async () => undefined)
  };
});

vi.mock('../src/audit', () => {
  return {
    writeAudit: vi.fn(async () => undefined)
  };
});

import templatesRouter from '../src/routes/templates';

const app = express();
app.use(express.json());
app.use('/api/templates', templatesRouter);

describe('templates routes', () => {
  it('GET /api/templates lists templates', async () => {
    const res = await request(app).get('/api/templates');
    expect(res.status).toBe(200);
    expect(res.body.templates).toHaveLength(2);
    expect(res.body.templates[0].name).toBe('default');
  });

  it('GET /api/templates/:name returns yaml', async () => {
    const res = await request(app).get('/api/templates/default');
    expect(res.status).toBe(200);
    expect(res.body.yaml).toContain('name: default');
  });

  it('PUT /api/templates requires yaml', async () => {
    const res = await request(app).put('/api/templates').send({});
    expect(res.status).toBe(400);
  });

  it('PUT /api/templates upserts from yaml', async () => {
    const res = await request(app)
      .put('/api/templates')
      .send({ yaml: 'name: from-yaml\n' });

    expect(res.status).toBe(200);
    expect(res.body.template.name).toBe('from-yaml');
  });

  it('DELETE /api/templates/:name returns ok', async () => {
    const res = await request(app).delete('/api/templates/offline');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('OK');
  });
});
