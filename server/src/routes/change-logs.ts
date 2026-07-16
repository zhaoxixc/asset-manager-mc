import { Router, Request, Response } from 'express';
import { Database } from '../database/index.js';
import { ChangeLogService } from '../services/change-log.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { paginate } from '../utils/response.js';

export function createChangeLogRouter(db: Database): Router {
  const router = Router();
  const changeLogService = new ChangeLogService(db);

  router.use(authMiddleware);

  /** GET /api/change-logs - 变动记录列表 */
  router.get('/', (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const assetCode = req.query.assetCode as string | undefined;
    const action = req.query.action as string | undefined;

    const result = changeLogService.list({ page, pageSize, assetCode, action });
    res.json(paginate(result.items, result.total, page, pageSize));
  });

  return router;
}
