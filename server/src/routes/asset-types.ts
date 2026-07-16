import { Router, Request, Response } from 'express';
import { Database } from '../database/index.js';
import { AssetTypeService } from '../services/asset-type.service.js';
import { AuditLogService } from '../services/audit-log.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { success, error } from '../utils/response.js';

export function createAssetTypeRouter(db: Database): Router {
  const router = Router();
  const auditLogService = new AuditLogService(db);
  const assetTypeService = new AssetTypeService(db, auditLogService);

  router.use(authMiddleware);

  /** GET /api/asset-types - 资产类型列表（含资产数量） */
  router.get('/', (_req: Request, res: Response) => {
    const types = assetTypeService.listWithCount();
    res.json(success(types));
  });

  /** POST /api/asset-types - 新增资产类型 */
  router.post('/', (req: Request, res: Response) => {
    const { name } = req.body;
    if (!name?.trim()) {
      res.status(400).json(error(40000, '资产类型名称不能为空'));
      return;
    }

    const userId = req.user?.userId || '';
    const username = req.user?.username || '';
    const ip = req.clientIp || req.ip || req.socket.remoteAddress || 'unknown';

    const result = assetTypeService.create(name.trim(), userId, username, ip);
    if ('error' in result) {
      res.status(409).json(error(40900, result.error));
      return;
    }
    res.status(201).json(success(result, '新增成功'));
  });

  /** PUT /api/asset-types/:id - 更新资产类型 */
  router.put('/:id', (req: Request, res: Response) => {
    const { name } = req.body;
    if (!name?.trim()) {
      res.status(400).json(error(40000, '资产类型名称不能为空'));
      return;
    }

    const userId = req.user?.userId || '';
    const username = req.user?.username || '';
    const ip = req.clientIp || req.ip || req.socket.remoteAddress || 'unknown';

    const result = assetTypeService.update(String(req.params.id), name.trim(), userId, username, ip);
    if (!result) {
      res.status(404).json(error(40400, '资产类型不存在'));
      return;
    }
    if ('error' in result) {
      res.status(409).json(error(40900, result.error));
      return;
    }
    res.json(success(result, '更新成功'));
  });

  /** DELETE /api/asset-types/:id - 删除资产类型 */
  router.delete('/:id', (req: Request, res: Response) => {
    const userId = req.user?.userId || '';
    const username = req.user?.username || '';
    const ip = req.clientIp || req.ip || req.socket.remoteAddress || 'unknown';

    const deleted = assetTypeService.delete(String(req.params.id), userId, username, ip);
    if (!deleted) {
      res.status(404).json(error(40400, '资产类型不存在'));
      return;
    }
    res.json(success(null, '删除成功'));
  });

  return router;
}
