import { Router, Request, Response } from 'express';
import { readAudit } from '../audit';

const router = Router();

// GET /audit?space=name&limit=200
router.get('/', async (req: Request, res: Response) => {
  try {
    const space = req.query.space ? String(req.query.space) : undefined;
    const limit = req.query.limit ? parseInt(String(req.query.limit)) : 200;

    const events = await readAudit({
      space,
      limit: Math.max(1, Math.min(1000, isNaN(limit) ? 200 : limit))
    });

    res.json({ events });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
