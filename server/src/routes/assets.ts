import { Router, Request, Response } from 'express';
import { Database } from '../database/index.js';
import { AssetService } from '../services/asset.service.js';
import { AuditLogService } from '../services/audit-log.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { success, error, paginate } from '../utils/response.js';
import express from 'express';

export function createAssetRouter(db: Database): Router {
  const router = Router();
  const auditLogService = new AuditLogService(db);
  const assetService = new AssetService(db, auditLogService);

  // 所有路由都需要认证
  router.use(authMiddleware);

  /** GET /api/assets - 资产列表（分页） */
  router.get('/', (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const keyword = req.query.keyword as string | undefined;
    const user = req.query.user as string | undefined;
    const type = req.query.type as string | undefined;
    const department = req.query.department as string | undefined;
    const status = req.query.status as string | undefined;
    const location = req.query.location as string | undefined;
    const sortBy = req.query.sortBy as string | undefined;
    const sortOrder = req.query.sortOrder as string | undefined;

    const result = assetService.list({
      page, pageSize, keyword, user, type, department, status, location, sortBy, sortOrder,
    });

    res.json(paginate(result.items, result.total, page, pageSize));
  });

  /** GET /api/assets/export - 导出全部资产（无分页） */
  router.get('/export', (req: Request, res: Response) => {
    const keyword = req.query.keyword as string | undefined;
    const user = req.query.user as string | undefined;
    const type = req.query.type as string | undefined;
    const department = req.query.department as string | undefined;
    const status = req.query.status as string | undefined;
    const location = req.query.location as string | undefined;
    const sortBy = req.query.sortBy as string | undefined;
    const sortOrder = req.query.sortOrder as string | undefined;
    const items = assetService.listAll({ keyword, user, type, department, status, location, sortBy, sortOrder });
    res.json(success(items));
  });

  /** GET /api/assets/:id - 资产详情 */
  router.get('/:id', (req: Request, res: Response) => {
    const asset = assetService.getById(String(req.params.id));
    if (!asset) {
      res.status(404).json(error(40400, '资产不存在'));
      return;
    }
    res.json(success(asset));
  });

  /** POST /api/assets - 新增资产 */
  router.post('/', (req: Request, res: Response) => {
    const userId = req.user?.userId || '';
    const username = req.user?.username || '';
    const ip = req.clientIp || req.ip || req.socket.remoteAddress || 'unknown';

    try {
      const asset = assetService.create(req.body, userId, username, ip);
      res.status(201).json(success(asset, '新增成功'));
    } catch (err) {
      const message = (err as Error).message || '新增失败';
      if (message.includes('已存在')) {
        res.status(409).json(error(40900, message));
      } else {
        res.status(400).json(error(40000, message));
      }
    }
  });

  /** PUT /api/assets/:id - 更新资产 */
  router.put('/:id', (req: Request, res: Response) => {
    const userId = req.user?.userId || '';
    const username = req.user?.username || '';
    const ip = req.clientIp || req.ip || req.socket.remoteAddress || 'unknown';

    const asset = assetService.update(String(req.params.id), req.body, userId, username, ip);
    if (!asset) {
      res.status(404).json(error(40400, '资产不存在'));
      return;
    }
    res.json(success(asset, '更新成功'));
  });

  /** DELETE /api/assets/:id - 删除资产 */
  router.delete('/:id', (req: Request, res: Response) => {
    const userId = req.user?.userId || '';
    const username = req.user?.username || '';
    const ip = req.clientIp || req.ip || req.socket.remoteAddress || 'unknown';

    const deleted = assetService.delete(String(req.params.id), userId, username, ip);
    if (!deleted) {
      res.status(404).json(error(40400, '资产不存在'));
      return;
    }
    res.json(success(null, '删除成功'));
  });

  /** POST /api/assets/batch-delete - 批量删除 */
  router.post('/batch-delete', (req: Request, res: Response) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json(error(40000, '请选择要删除的资产'));
      return;
    }
    if (ids.length > 500) {
      res.status(400).json(error(40000, '单次批量删除不能超过500条'));
      return;
    }

    const userId = req.user?.userId || '';
    const username = req.user?.username || '';
    const ip = req.clientIp || req.ip || req.socket.remoteAddress || 'unknown';

    const result = assetService.batchDelete(ids, userId, username, ip);
    res.json(success(result, '批量删除成功'));
  });

  /** POST /api/assets/import - 导入资产（允许大请求体） */
  router.post('/import', express.json({ limit: '50mb' }), (req: Request, res: Response) => {
    const { assets } = req.body;
    if (!Array.isArray(assets) || assets.length === 0) {
      res.status(400).json(error(40000, '导入数据不能为空'));
      return;
    }

    const userId = req.user?.userId || '';
    const username = req.user?.username || '';
    const ip = req.clientIp || req.ip || req.socket.remoteAddress || 'unknown';

    const result = assetService.import(assets, userId, username, ip);
    res.json(success(result));
  });

  return router;
}
