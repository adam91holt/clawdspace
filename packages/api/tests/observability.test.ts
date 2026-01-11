import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/docker', () => {
  return {
    getSpaceObservability: vi.fn(async () => ({
      stats: {
        cpuPercent: 1,
        memoryUsageBytes: 2,
        memoryLimitBytes: 3,
        pids: 4,
        networkRxBytes: 5,
        networkTxBytes: 6,
        blockReadBytes: 7,
        blockWriteBytes: 8
      },
      workspaceDisk: { totalBytes: 100, usedBytes: 50, availBytes: 50, usedPercent: 50, path: '/workspace' },
      workspaceSizeBytes: 1234,
      top: [{ pid: 1, cpu: 9.9, mem: 1.1, etime: '00:00:01', command: 'bash' }],
      bashHistoryTail: '123 ls\n124 pwd'
    }))
  };
});

import request from 'supertest';
import express from 'express';
import spacesRouter from '../src/routes/spaces';

describe('spaces observability', () => {
  it('GET /spaces/:name/observability returns snapshot', async () => {
    const app = express();
    app.use(express.json());
    app.use('/spaces', spacesRouter);

    const res = await request(app).get('/spaces/demo/observability');
    expect(res.status).toBe(200);
    expect(res.body.observability.stats.pids).toBe(4);
    expect(res.body.observability.workspaceSizeBytes).toBe(1234);
    expect(res.body.observability.top[0].command).toBe('bash');
  });
});
