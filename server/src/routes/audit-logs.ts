import { Router, Request, Response } from 'express';
import { Database } from '../database/index.js';
import { AuditLogService } from '../services/audit-log.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';
import { paginate, success } from '../utils/response.js';

export function createAuditLogRouter(db: Database): Router {
  const router = Router();
  const auditLogService = new AuditLogService(db);

  router.use(authMiddleware);

  /** POST /api/audit-logs/export - 记录导出资产动作（导出本身不限角色，前端生成文件前调用） */
  router.post('/export', (req: Request, res: Response) => {
    const format = String(req.body.format || 'excel');
    const count = parseInt(String(req.body.count || '0'), 10) || 0;
    const userId = req.user?.userId || '';
    const username = req.user?.username || '';
    const ip = req.clientIp || req.ip || req.socket.remoteAddress || 'unknown';
    auditLogService.create({
      userId, username, action: '导出资产', resource: 'assets',
      detail: `导出资产数据（${format === 'csv' ? 'CSV' : 'Excel'}），共 ${count} 条`,
      ip,
    });
    res.json(success(null, '已记录'));
  });

  // 以下路由仅超级管理员
  router.use(roleMiddleware(['super_admin']));

  /** GET /api/audit-logs/actions - 实际存在的操作类型（按出现次数降序，用于筛选下拉） */
  router.get('/actions', (_req: Request, res: Response) => {
    const rows = db.all('SELECT action, COUNT(*) AS count FROM audit_logs GROUP BY action ORDER BY count DESC');
    res.json(success(rows.map((r) => r.action as string)));
  });

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
