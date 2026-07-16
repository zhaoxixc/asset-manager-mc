import { Router, Request, Response } from 'express';
import { Database } from '../database/index.js';
import { DepartmentService } from '../services/department.service.js';
import { AuditLogService } from '../services/audit-log.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { success, error } from '../utils/response.js';

export function createDepartmentRouter(db: Database): Router {
  const router = Router();
  const auditLogService = new AuditLogService(db);
  const deptService = new DepartmentService(db, auditLogService);

  router.use(authMiddleware);

  /** GET /api/departments - 部门列表（含资产数量） */
  router.get('/', (_req: Request, res: Response) => {
    const departments = deptService.listWithCount();
    res.json(success(departments));
  });

  /** POST /api/departments - 新增部门 */
  router.post('/', (req: Request, res: Response) => {
    const { name } = req.body;
    if (!name?.trim()) {
      res.status(400).json(error(40000, '部门名称不能为空'));
      return;
    }

    const userId = req.user?.userId || '';
    const username = req.user?.username || '';
    const ip = req.clientIp || req.ip || req.socket.remoteAddress || 'unknown';

    const result = deptService.create(name.trim(), userId, username, ip);
    if ('error' in result) {
      res.status(409).json(error(40900, result.error));
      return;
    }
    res.status(201).json(success(result, '新增成功'));
  });

  /** PUT /api/departments/:id - 更新部门 */
  router.put('/:id', (req: Request, res: Response) => {
    const { name } = req.body;
    if (!name?.trim()) {
      res.status(400).json(error(40000, '部门名称不能为空'));
      return;
    }

    const userId = req.user?.userId || '';
    const username = req.user?.username || '';
    const ip = req.clientIp || req.ip || req.socket.remoteAddress || 'unknown';

    const result = deptService.update(String(req.params.id), name.trim(), userId, username, ip);
    if (!result) {
      res.status(404).json(error(40400, '部门不存在'));
      return;
    }
    if ('error' in result) {
      res.status(409).json(error(40900, result.error));
      return;
    }
    res.json(success(result, '更新成功'));
  });

  /** DELETE /api/departments/:id - 删除部门 */
  router.delete('/:id', (req: Request, res: Response) => {
    const userId = req.user?.userId || '';
    const username = req.user?.username || '';
    const ip = req.clientIp || req.ip || req.socket.remoteAddress || 'unknown';

    const deleted = deptService.delete(String(req.params.id), userId, username, ip);
    if (!deleted) {
      res.status(404).json(error(40400, '部门不存在'));
      return;
    }
    res.json(success(null, '删除成功'));
  });

  return router;
}
