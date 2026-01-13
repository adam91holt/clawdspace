import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { mockDocker, mockSpaces, resetMocks, createMockSpace } from './mocks/docker';

vi.mock('../src/docker', () => mockDocker);

import spacesRouter from '../src/routes/spaces';

const app = express();
app.use(express.json());
app.use('/api/spaces', spacesRouter);

describe('spaces extra endpoints', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('GET /api/spaces/:name/stats returns stats', async () => {
    mockSpaces.set('demo', createMockSpace('demo'));

    const res = await request(app).get('/api/spaces/demo/stats');
    expect(res.status).toBe(200);
    expect(res.body.stats).toBeDefined();
    expect(res.body.stats.pids).toBe(1);

    expect(mockDocker.getSpaceStats).toHaveBeenCalledWith('demo');
  });

  it('DELETE /api/spaces/:name supports removeVolume=true', async () => {
    mockSpaces.set('demo', createMockSpace('demo'));

    const res = await request(app).delete('/api/spaces/demo?removeVolume=true');
    expect(res.status).toBe(200);
    expect(mockDocker.destroySpace).toHaveBeenCalledWith('demo', true);
  });

  it('PUT/GET /api/spaces/:name/file uses contentBase64', async () => {
    await mockDocker.createSpace('demo');

    const contentBase64 = Buffer.from('hello', 'utf8').toString('base64');

    const putRes = await request(app)
      .put('/api/spaces/demo/file?path=/hello.txt')
      .send({ contentBase64 });

    expect(putRes.status).toBe(200);

    const getRes = await request(app).get('/api/spaces/demo/file?path=/hello.txt');
    expect(getRes.status).toBe(200);
    expect(getRes.body.contentBase64).toBe(contentBase64);

    expect(mockDocker.writeFile).toHaveBeenCalled();
    expect(mockDocker.readFile).toHaveBeenCalled();
  });
});
