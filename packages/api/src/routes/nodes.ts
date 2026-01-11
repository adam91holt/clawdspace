import { Router, Request, Response } from 'express';
import { getNodesCache } from '../nodesCache';

const router = Router();

// GET /nodes - cached list of nodes
router.get('/', async (_req: Request, res: Response) => {
  const { nodes, lastUpdatedAt } = getNodesCache();
  res.json({ nodes, lastUpdatedAt });
});

export default router;
