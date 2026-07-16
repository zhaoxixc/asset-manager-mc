import { Router, Request, Response } from 'express';
import { Database } from '../database/index.js';
import { DashboardService } from '../services/dashboard.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { success } from '../utils/response.js';

export function createDashboardRouter(db: Database): Router {
  const router = Router();
  const dashboardService = new DashboardService(db);

  router.use(authMiddleware);

  /** GET /api/dashboard/stats - 看板统计 */
  router.get('/stats', (_req: Request, res: Response) => {
    const stats = dashboardService.getStats();
    res.json(success(stats));
  });

  return router;
}
