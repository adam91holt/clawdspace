import { describe, it, expect, beforeEach, vi, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { mockDocker, mockSpaces, resetMocks, createMockSpace } from './mocks/docker';

// Mock the docker module before importing routes
vi.mock('../src/docker', () => mockDocker);

// Import after mocking
import spacesRouter from '../src/routes/spaces';
import systemRouter from '../src/routes/system';

// Create test app
const app = express();
app.use(express.json());
app.use('/api/spaces', spacesRouter);
app.use('/api/system', systemRouter);

describe('Clawdspace API', () => {
  beforeEach(() => {
    resetMocks();
  });

  describe('GET /api/spaces', () => {
    it('returns empty array when no spaces exist', async () => {
      const res = await request(app).get('/api/spaces');
      
      expect(res.status).toBe(200);
      expect(res.body.spaces).toEqual([]);
    });

    it('returns list of spaces', async () => {
      mockSpaces.set('test1', createMockSpace('test1'));
      mockSpaces.set('test2', createMockSpace('test2', { status: 'paused' }));

      const res = await request(app).get('/api/spaces');
      
      expect(res.status).toBe(200);
      expect(res.body.spaces).toHaveLength(2);
      expect(res.body.spaces[0].name).toBe('test1');
      expect(res.body.spaces[1].name).toBe('test2');
    });
  });

  describe('POST /api/spaces', () => {
    it('creates a new space with default settings', async () => {
      const res = await request(app)
        .post('/api/spaces')
        .send({ name: 'my-space' });
      
      expect(res.status).toBe(201);
      expect(res.body.space.name).toBe('my-space');
      expect(res.body.space.status).toBe('running');
      expect(mockDocker.createSpace).toHaveBeenCalledWith('my-space', '2g', 1, false, undefined, undefined, expect.any(Object));
    });

    it('creates a space with custom memory and cpus', async () => {
      const res = await request(app)
        .post('/api/spaces')
        .send({ name: 'custom-space', memory: '4g', cpus: 2 });
      
      expect(res.status).toBe(201);
      expect(mockDocker.createSpace).toHaveBeenCalledWith('custom-space', '4g', 2, false, undefined, undefined, expect.any(Object));
    });

    it('rejects invalid space names', async () => {
      const res = await request(app)
        .post('/api/spaces')
        .send({ name: 'invalid name!' });
      
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid name');
    });

    it('rejects duplicate space names', async () => {
      mockSpaces.set('existing', createMockSpace('existing'));
      mockDocker.getContainer.mockResolvedValueOnce({ name: 'existing' });

      const res = await request(app)
        .post('/api/spaces')
        .send({ name: 'existing' });
      
      expect(res.status).toBe(409);
      expect(res.body.error).toContain('already exists');
    });

    it('accepts alphanumeric names with dashes and underscores', async () => {
      const validNames = ['my-space', 'my_space', 'MySpace123', 'test-123_abc'];
      
      for (const name of validNames) {
        resetMocks();
        const res = await request(app)
          .post('/api/spaces')
          .send({ name });
        
        expect(res.status).toBe(201);
      }
    });
  });

  describe('GET /api/spaces/:name', () => {
    it('returns space details', async () => {
      const space = createMockSpace('test-space');
      mockSpaces.set('test-space', space);
      mockDocker.getContainer.mockResolvedValueOnce({ name: 'test-space' });
      mockDocker.formatSpace.mockResolvedValueOnce(space);

      const res = await request(app).get('/api/spaces/test-space');
      
      expect(res.status).toBe(200);
      expect(res.body.space.name).toBe('test-space');
    });

    it('returns 404 for non-existent space', async () => {
      mockDocker.getContainer.mockResolvedValueOnce(null);

      const res = await request(app).get('/api/spaces/non-existent');
      
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/spaces/:name', () => {
    it('destroys a space', async () => {
      mockSpaces.set('to-delete', createMockSpace('to-delete'));

      const res = await request(app).delete('/api/spaces/to-delete');
      
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Space destroyed');
      expect(mockDocker.destroySpace).toHaveBeenCalledWith('to-delete', false);
    });

    it('returns error for non-existent space', async () => {
      mockDocker.destroySpace.mockRejectedValueOnce(new Error('Space not found'));

      const res = await request(app).delete('/api/spaces/non-existent');
      
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/spaces/:name/stop', () => {
    it('pauses a running space', async () => {
      mockSpaces.set('running-space', createMockSpace('running-space'));

      const res = await request(app).post('/api/spaces/running-space/stop');
      
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Space paused');
      expect(mockDocker.stopSpace).toHaveBeenCalledWith('running-space');
    });
  });

  describe('POST /api/spaces/:name/start', () => {
    it('resumes a paused space', async () => {
      mockSpaces.set('paused-space', createMockSpace('paused-space', { status: 'paused' }));

      const res = await request(app).post('/api/spaces/paused-space/start');
      
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Space started');
      expect(mockDocker.startSpace).toHaveBeenCalledWith('paused-space');
    });
  });

  describe('POST /api/spaces/:name/exec', () => {
    it('executes a command and returns output', async () => {
      mockSpaces.set('exec-space', createMockSpace('exec-space'));

      const res = await request(app)
        .post('/api/spaces/exec-space/exec')
        .send({ command: 'echo hello' });
      
      expect(res.status).toBe(200);
      expect(res.body.stdout).toContain('echo hello');
      expect(res.body.exitCode).toBe(0);
    });

    it('requires a command', async () => {
      const res = await request(app)
        .post('/api/spaces/any-space/exec')
        .send({});
      
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Command required');
    });

    it('accepts command as array', async () => {
      mockSpaces.set('exec-space', createMockSpace('exec-space'));

      const res = await request(app)
        .post('/api/spaces/exec-space/exec')
        .send({ command: ['python3', '-c', 'print("hello")'] });
      
      expect(res.status).toBe(200);
      expect(mockDocker.execInSpace).toHaveBeenCalledWith(
        'exec-space',
        ['python3', '-c', 'print("hello")']
      );
    });
  });

  describe('GET /api/system', () => {
    it('returns system information', async () => {
      const res = await request(app).get('/api/system');
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('hostname');
      expect(res.body).toHaveProperty('cpus');
      expect(res.body).toHaveProperty('memory');
      expect(res.body).toHaveProperty('docker');
    });
  });
});

describe('Space Lifecycle', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('full lifecycle: create → exec → stop → start → destroy', async () => {
    // Create
    let res = await request(app)
      .post('/api/spaces')
      .send({ name: 'lifecycle-test' });
    expect(res.status).toBe(201);
    expect(res.body.space.status).toBe('running');

    // Exec
    res = await request(app)
      .post('/api/spaces/lifecycle-test/exec')
      .send({ command: 'whoami' });
    expect(res.status).toBe(200);

    // Stop
    res = await request(app).post('/api/spaces/lifecycle-test/stop');
    expect(res.status).toBe(200);

    // Start
    res = await request(app).post('/api/spaces/lifecycle-test/start');
    expect(res.status).toBe(200);

    // Destroy
    res = await request(app).delete('/api/spaces/lifecycle-test');
    expect(res.status).toBe(200);
  });

  it('exec auto-resumes paused space', async () => {
    const space = createMockSpace('paused-exec', { status: 'paused' });
    mockSpaces.set('paused-exec', space);

    const res = await request(app)
      .post('/api/spaces/paused-exec/exec')
      .send({ command: 'date' });
    
    expect(res.status).toBe(200);
    // Mock should have auto-resumed
    expect(mockSpaces.get('paused-exec')?.status).toBe('running');
  });
});
