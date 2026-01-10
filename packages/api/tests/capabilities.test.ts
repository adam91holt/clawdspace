import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import os from 'os';

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn((cmd, opts, cb) => {
    if (typeof opts === 'function') {
      cb = opts;
    }
    
    // Mock nvidia-smi response
    if (cmd.includes('nvidia-smi')) {
      cb(null, { stdout: 'NVIDIA GeForce RTX 3090, 24576 MiB' });
    } else if (cmd.includes('df')) {
      cb(null, { stdout: '/dev/sda1 100G 50G 50G 50%' });
    } else {
      cb(new Error('Unknown command'));
    }
  })
}));

// Mock dockerode
vi.mock('dockerode', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      info: vi.fn().mockResolvedValue({
        ServerVersion: '24.0.0',
        Containers: 5,
        ContainersRunning: 3,
        ContainersPaused: 1,
        Images: 10
      })
    }))
  };
});

import systemRouter from '../src/routes/system';

const app = express();
app.use(express.json());
app.use('/api/system', systemRouter);

describe('System Capabilities', () => {
  describe('GET /api/system', () => {
    it('returns system information with capabilities', async () => {
      const res = await request(app).get('/api/system');
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('hostname');
      expect(res.body).toHaveProperty('cpus');
      expect(res.body).toHaveProperty('memory');
      expect(res.body).toHaveProperty('docker');
      expect(res.body).toHaveProperty('capabilities');
    });

    it('includes GPU info in capabilities when available', async () => {
      const res = await request(app).get('/api/system');
      
      expect(res.body.capabilities).toHaveProperty('gpu');
      expect(res.body.capabilities).toHaveProperty('arch');
      expect(res.body.capabilities).toHaveProperty('platform');
    });
  });

  describe('GET /api/system/capabilities', () => {
    it('returns just capabilities', async () => {
      const res = await request(app).get('/api/system/capabilities');
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('gpu');
      expect(res.body).toHaveProperty('arch');
      expect(res.body).toHaveProperty('platform');
      expect(res.body).toHaveProperty('cpus');
      expect(res.body).toHaveProperty('memory');
    });
  });
});

describe('Memory and Resource Reporting', () => {
  it('formats memory correctly', async () => {
    const res = await request(app).get('/api/system');
    
    expect(res.body.memory).toHaveProperty('total');
    expect(res.body.memory).toHaveProperty('free');
    expect(res.body.memory).toHaveProperty('used');
    expect(res.body.memory).toHaveProperty('percentage');
    expect(res.body.memory.percentage).toMatch(/^\d+\.\d+%$/);
  });

  it('includes docker stats', async () => {
    const res = await request(app).get('/api/system');
    
    expect(res.body.docker).toHaveProperty('version');
    expect(res.body.docker).toHaveProperty('containers');
    expect(res.body.docker).toHaveProperty('containersRunning');
    expect(res.body.docker).toHaveProperty('containersPaused');
  });
});
