import { Router, Request, Response } from 'express';
import * as docker from '../docker';
import { CreateSpaceRequest, ExecRequest } from '../types';

const router = Router();

// GET /spaces - List all spaces
router.get('/', async (_req: Request, res: Response) => {
  try {
    const spaces = await docker.listSpaces();
    res.json({ spaces });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /spaces - Create space
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, memory = '2g', cpus = 1 } = req.body as CreateSpaceRequest;
    
    if (!name || !/^[a-zA-Z0-9_-]+$/.test(name)) {
      return res.status(400).json({ error: 'Invalid name (alphanumeric, _, - only)' });
    }
    
    // Check if exists
    const existing = await docker.getContainer(name);
    if (existing) {
      return res.status(409).json({ error: 'Space already exists' });
    }
    
    const space = await docker.createSpace(name, memory, cpus);
    res.status(201).json({ space });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /spaces/:name - Get space details
router.get('/:name', async (req: Request, res: Response) => {
  try {
    const container = await docker.getContainer(req.params.name);
    if (!container) {
      return res.status(404).json({ error: 'Space not found' });
    }
    
    const space = await docker.formatSpace(container);
    res.json({ space });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// DELETE /spaces/:name - Destroy space
router.delete('/:name', async (req: Request, res: Response) => {
  try {
    await docker.destroySpace(req.params.name);
    res.json({ message: 'Space destroyed' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /spaces/:name/stop - Pause space
router.post('/:name/stop', async (req: Request, res: Response) => {
  try {
    await docker.stopSpace(req.params.name);
    res.json({ message: 'Space paused' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /spaces/:name/start - Resume space
router.post('/:name/start', async (req: Request, res: Response) => {
  try {
    await docker.startSpace(req.params.name);
    res.json({ message: 'Space started' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /spaces/:name/exec - Execute command
router.post('/:name/exec', async (req: Request, res: Response) => {
  try {
    const { command } = req.body as ExecRequest;
    
    if (!command) {
      return res.status(400).json({ error: 'Command required' });
    }
    
    const result = await docker.execInSpace(req.params.name, command);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
