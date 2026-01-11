import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/docker', () => {
  return {
    execInSpace: vi.fn(async () => ({ stdout: 'https://github.com/org/repo.git\n', stderr: '', exitCode: 0 })),
    setLastActivity: vi.fn()
  };
});

import request from 'supertest';
import express from 'express';
import gitRouter from '../src/routes/git';

describe('git push endpoint', () => {
  it('requires token', async () => {
    const app = express();
    app.use(express.json());
    app.use('/spaces', gitRouter);

    const res = await request(app).post('/spaces/s1/git/push').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('token');
  });

  it('accepts token and runs push', async () => {
    const app = express();
    app.use(express.json());
    app.use('/spaces', gitRouter);

    const res = await request(app).post('/spaces/s1/git/push').send({ token: 't' });
    expect(res.status).toBe(200);
    expect(res.body.exitCode).toBe(0);
  });
});
