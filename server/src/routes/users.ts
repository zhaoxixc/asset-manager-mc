import { Router, Request, Response } from 'express';
import { Database } from '../database/index.js';
import { UserService } from '../services/user.service.js';
import { AuditLogService } from '../services/audit-log.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';
import { success, error } from '../utils/response.js';

export function createUserRouter(db: Database): Router {
  const router = Router();
  const auditLogService = new AuditLogService(db);
  const userService = new UserService(db, auditLogService);

  router.use(authMiddleware);
  router.use(roleMiddleware(['super_admin']));

  /** GET /api/users - 用户列表 */
  router.get('/', (_req: Request, res: Response) => {
    const users = userService.list();
    res.json(success(users));
  });

  /** POST /api/users - 新增用户 */
  router.post('/', (req: Request, res: Response) => {
    const { username, password, realName, role, status } = req.body;

    if (!username?.trim() || !realName?.trim()) {
      res.status(400).json(error(40000, '用户名和真实姓名不能为空'));
      return;
    }

    const userId = req.user?.userId || '';
    const currentUsername = req.user?.username || '';
    const ip = req.clientIp || req.ip || req.socket.remoteAddress || 'unknown';

    const result = userService.create(
      { username: username.trim(), password: password || '123456', realName: realName.trim(), role: role || 'user', status: status || 'active' },
      userId, currentUsername, ip
    );

    if ('error' in result) {
      res.status(409).json(error(40900, (result as { error: string }).error));
      return;
    }

    res.status(201).json(success(result, '新增成功'));
  });

  /** PUT /api/users/:id - 更新用户 */
  router.put('/:id', (req: Request, res: Response) => {
    const { realName, role, status, password } = req.body;

    const userId = req.user?.userId || '';
    const currentUsername = req.user?.username || '';
    const ip = req.clientIp || req.ip || req.socket.remoteAddress || 'unknown';

    const result = userService.update(
      String(req.params.id),
      { realName, role, status, password },
      userId, currentUsername, ip
    );

    if (!result) {
      res.status(404).json(error(40400, '用户不存在'));
      return;
    }

    res.json(success(result, '更新成功'));
  });

  /** DELETE /api/users/:id - 删除用户 */
  router.delete('/:id', (req: Request, res: Response) => {
    // 不能删除自己
    if (String(req.params.id) === req.user?.userId) {
      res.status(400).json(error(40000, '不能删除当前登录用户'));
      return;
    }

    const userId = req.user?.userId || '';
    const currentUsername = req.user?.username || '';
    const ip = req.clientIp || req.ip || req.socket.remoteAddress || 'unknown';

    const deleted = userService.delete(String(req.params.id), userId, currentUsername, ip);
    if (!deleted) {
      res.status(404).json(error(40400, '用户不存在'));
      return;
    }

    res.json(success(null, '删除成功'));
  });

  /** PUT /api/users/:id/reset-password - 重置密码 */
  router.put('/:id/reset-password', (req: Request, res: Response) => {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 4) {
      res.status(400).json(error(40000, '新密码长度不能少于4位'));
      return;
    }

    const userId = req.user?.userId || '';
    const currentUsername = req.user?.username || '';
    const ip = req.clientIp || req.ip || req.socket.remoteAddress || 'unknown';

    const reset = userService.resetPassword(String(req.params.id), newPassword, userId, currentUsername, ip);
    if (!reset) {
      res.status(404).json(error(40400, '用户不存在'));
      return;
    }

    res.json(success(null, '密码重置成功'));
  });

  return router;
}
