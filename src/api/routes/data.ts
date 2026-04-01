import { Router } from 'express';
import type { AuthRequest } from '../middleware/auth';
import { collectUserData, deleteUserData } from '../../services/UserDataService';

export function createDataRouter(): Router {
  const router = Router();

  router.get('/me', async (req: AuthRequest, res) => {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    try {
      const data = await collectUserData(userId);
      res.json(data);
    } catch {
      res.status(500).json({ error: 'Failed to collect user data' });
    }
  });

  router.delete('/me', async (req: AuthRequest, res) => {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    try {
      const result = await deleteUserData(userId);
      res.json({ success: true, result });
    } catch {
      res.status(500).json({ error: 'Failed to delete user data' });
    }
  });

  return router;
}
