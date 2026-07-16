import { Router, Request, Response } from 'express';
import { Database } from '../database/index.js';
import { AuditLogService } from '../services/audit-log.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';
import { paginate } from '../utils/response.js';

export function createAuditLogRouter(db: Database): Router {
  const router = Router();
  const auditLogService = new AuditLogService(db);

  router.use(authMiddleware);
  router.use(roleMiddleware(['super_admin']));

  /** GET /api/audit-logs - 审计日志列表 */
  router.get('/', (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const action = req.query.action as string | undefined;
    const username = req.query.username as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const result = auditLogService.list({
      page, pageSize, action, username, startDate, endDate,
    });

    res.json(paginate(result.items, result.total, page, pageSize));
  });

  return router;
}
