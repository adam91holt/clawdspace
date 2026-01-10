import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { mockDocker, mockSpaces, resetMocks, createMockSpace } from './mocks/docker';

// Mock the docker module
vi.mock('../src/docker', () => mockDocker);

import spacesRouter from '../src/routes/spaces';

const app = express();
app.use(express.json());
app.use('/api/spaces', spacesRouter);

describe('GPU Support', () => {
  beforeEach(() => {
    resetMocks();
  });

  describe('POST /api/spaces with GPU', () => {
    it('creates a GPU-enabled space', async () => {
      const res = await request(app)
        .post('/api/spaces')
        .send({ name: 'gpu-space', gpu: true });
      
      expect(res.status).toBe(201);
      expect(mockDocker.createSpace).toHaveBeenCalledWith(
        'gpu-space', '2g', 1, true, undefined
      );
    });

    it('creates a GPU space with custom image', async () => {
      const res = await request(app)
        .post('/api/spaces')
        .send({ 
          name: 'custom-gpu', 
          gpu: true, 
          image: 'nvidia/cuda:12.0-base' 
        });
      
      expect(res.status).toBe(201);
      expect(mockDocker.createSpace).toHaveBeenCalledWith(
        'custom-gpu', '2g', 1, true, 'nvidia/cuda:12.0-base'
      );
    });

    it('creates a non-GPU space by default', async () => {
      const res = await request(app)
        .post('/api/spaces')
        .send({ name: 'normal-space' });
      
      expect(res.status).toBe(201);
      expect(mockDocker.createSpace).toHaveBeenCalledWith(
        'normal-space', '2g', 1, false, undefined
      );
    });
  });
});
