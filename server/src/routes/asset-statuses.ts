import { Router, Request, Response } from 'express';
import { Database } from '../database/index.js';
import { AssetStatusService } from '../services/asset-status.service.js';
import { AuditLogService } from '../services/audit-log.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { success, error } from '../utils/response.js';

export function createAssetStatusRouter(db: Database): Router {
  const router = Router();
  const auditLogService = new AuditLogService(db);
  const statusService = new AssetStatusService(db, auditLogService);

  router.use(authMiddleware);

  /** GET /api/asset-statuses - 资产状态列表（含资产数量） */
  router.get('/', (_req: Request, res: Response) => {
    const statuses = statusService.listWithCount();
    res.json(success(statuses));
  });

  /** POST /api/asset-statuses - 新增资产状态 */
  router.post('/', (req: Request, res: Response) => {
    const { name, color } = req.body;
    if (!name?.trim()) {
      res.status(400).json(error(40000, '资产状态名称不能为空'));
      return;
    }
    const userId = req.user?.userId || '';
    const username = req.user?.username || '';
    const ip = req.clientIp || req.ip || req.socket.remoteAddress || 'unknown';
    const result = statusService.create(name.trim(), color || '#757575', userId, username, ip);
    if ('error' in result) {
      res.status(409).json(error(40900, result.error));
      return;
    }
    res.status(201).json(success(result, '新增成功'));
  });

  /** PUT /api/asset-statuses/:id - 更新资产状态 */
  router.put('/:id', (req: Request, res: Response) => {
    const { name, color } = req.body;
    if (!name?.trim()) {
      res.status(400).json(error(40000, '资产状态名称不能为空'));
      return;
    }
    const userId = req.user?.userId || '';
    const username = req.user?.username || '';
    const ip = req.clientIp || req.ip || req.socket.remoteAddress || 'unknown';
    const result = statusService.update(String(req.params.id), name.trim(), color || '#757575', userId, username, ip);
    if (!result) {
      res.status(404).json(error(40400, '资产状态不存在'));
      return;
    }
    if ('error' in result) {
      res.status(409).json(error(40900, result.error));
      return;
    }
    res.json(success(result, '更新成功'));
  });

  /** DELETE /api/asset-statuses/:id - 删除资产状态 */
  router.delete('/:id', (req: Request, res: Response) => {
    const userId = req.user?.userId || '';
    const username = req.user?.username || '';
    const ip = req.clientIp || req.ip || req.socket.remoteAddress || 'unknown';
    const deleted = statusService.delete(String(req.params.id), userId, username, ip);
    if (!deleted) {
      res.status(404).json(error(40400, '资产状态不存在'));
      return;
    }
    res.json(success(null, '删除成功'));
  });

  return router;
}