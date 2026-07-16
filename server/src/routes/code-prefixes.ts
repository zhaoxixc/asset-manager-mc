import { Router, Request, Response } from 'express';
import { Database } from '../database/index.js';
import { CodePrefixService } from '../services/code-prefix.service.js';
import { AuditLogService } from '../services/audit-log.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { success, error } from '../utils/response.js';

export function createCodePrefixRouter(db: Database): Router {
  const router = Router();
  const auditLogService = new AuditLogService(db);
  const prefixService = new CodePrefixService(db, auditLogService);

  router.use(authMiddleware);

  /** GET /api/code-prefixes - 编号前缀列表 */
  router.get('/', (_req: Request, res: Response) => {
    const prefixes = prefixService.list();
    res.json(success(prefixes));
  });

  /** POST /api/code-prefixes - 新增编号前缀 */
  router.post('/', (req: Request, res: Response) => {
    const { department, prefix, suffix, numberWidth } = req.body;
    if (!prefix?.trim()) {
      res.status(400).json(error(40000, '编号前缀不能为空'));
      return;
    }
    const userId = req.user?.userId || '';
    const username = req.user?.username || '';
    const ip = req.clientIp || req.ip || req.socket.remoteAddress || 'unknown';
    const result = prefixService.create(
      department?.trim() || '',
      prefix.trim(),
      suffix?.trim() || '',
      parseInt(numberWidth, 10) || 4,
      userId, username, ip
    );
    if ('error' in (result as { error?: string })) {
      res.status(409).json(error(40900, (result as { error: string }).error));
      return;
    }
    res.status(201).json(success(result, '新增成功'));
  });

  /** PUT /api/code-prefixes/:id - 更新编号前缀 */
  router.put('/:id', (req: Request, res: Response) => {
    const { department, prefix, suffix, numberWidth } = req.body;
    if (!prefix?.trim()) {
      res.status(400).json(error(40000, '编号前缀不能为空'));
      return;
    }
    const userId = req.user?.userId || '';
    const username = req.user?.username || '';
    const ip = req.clientIp || req.ip || req.socket.remoteAddress || 'unknown';
    const result = prefixService.update(
      String(req.params.id),
      department?.trim() || '',
      prefix.trim(),
      suffix?.trim() || '',
      parseInt(numberWidth, 10) || 4,
      userId, username, ip
    );
    if (!result) {
      res.status(404).json(error(40400, '编号前缀不存在'));
      return;
    }
    if ('error' in (result as { error?: string })) {
      res.status(409).json(error(40900, (result as { error: string }).error));
      return;
    }
    res.json(success(result, '更新成功'));
  });

/** DELETE /api/code-prefixes/:id - 删除编号前缀 */
  router.delete('/:id', (req: Request, res: Response) => {
    const userId = req.user?.userId || '';
    const username = req.user?.username || '';
    const ip = req.clientIp || req.ip || req.socket.remoteAddress || 'unknown';

    const deleted = prefixService.delete(String(req.params.id), userId, username, ip);
    if (!deleted) {
      res.status(404).json(error(40400, '编号前缀不存在'));
      return;
    }
    res.json(success(null, '删除成功'));
  });

  return router;
}