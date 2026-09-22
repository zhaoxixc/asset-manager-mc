import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { Database } from '../database/index.js';
import { UserService } from '../services/user.service.js';
import { AuditLogService } from '../services/audit-log.service.js';
import { LdapService } from '../services/ldap.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';
import { success, error } from '../utils/response.js';
import { hashPassword } from '../utils/password.js';
import { config } from '../config/index.js';

export function createUserRouter(db: Database, ldapService: LdapService | null): Router {
  const router = Router();
  const auditLogService = new AuditLogService(db);
  const userService = new UserService(db, auditLogService);

  router.use(authMiddleware);

  /** GET /api/users/options - 用户姓名选项（供资产表单下拉使用，所有登录用户可访问，不含邮箱等敏感信息） */
  router.get('/options', (_req: Request, res: Response) => {
    const rows = db.all("SELECT username, real_name, cn_name FROM users WHERE status = 'active' ORDER BY created_at ASC");
    const options = rows.map((r) => ({
      username: r.username as string,
      displayName: (r.cn_name as string) || (r.real_name as string) || (r.username as string),
      realName: r.real_name as string,
      cnName: r.cn_name as string,
    }));
    res.json(success(options));
  });

  // 以下路由仅超级管理员可访问
  router.use(roleMiddleware(['super_admin']));

  /** POST /api/users/sync-ldap - 从LDAP同步全部用户（预创建本地账号） */
  router.post('/sync-ldap', async (req: Request, res: Response) => {
    if (!config.ldap.enabled || !ldapService) {
      res.status(400).json(error(40000, 'LDAP认证未启用'));
      return;
    }

    const ldapUsers = await ldapService.listUsers();
    if (ldapUsers.length === 0) {
      res.status(502).json(error(50200, '未能从LDAP获取到用户，请检查LDAP连接和配置'));
      return;
    }

    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    let created = 0;
    let updated = 0;

    for (const lu of ldapUsers) {
      const existing = db.get('SELECT id, real_name, email FROM users WHERE username = ?', [lu.uid]) as Record<string, unknown> | undefined;

      if (existing) {
        // 已存在：仅补全姓名/邮箱，不改动角色、密码、状态
        const newName = lu.displayName || '';
        const newEmail = lu.email || '';
        const needName = !!newName && newName !== existing.real_name;
        const needEmail = !!newEmail && newEmail !== existing.email;
        if (needName || needEmail) {
          const fields: string[] = [];
          const params: unknown[] = [];
          if (needName) { fields.push('real_name = ?'); params.push(newName); }
          if (needEmail) { fields.push('email = ?'); params.push(newEmail); }
          params.push(now, existing.id);
          db.run(`UPDATE users SET ${fields.join(', ')}, updated_at = ? WHERE id = ?`, params);
          updated++;
        }
      } else {
        // 预创建账号：密码为随机占位，首次LDAP登录时自动同步
        db.run(
          'INSERT INTO users (id, username, password, real_name, email, auth_source, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [uuidv4(), lu.uid, hashPassword(uuidv4()), lu.displayName, lu.email, 'ldap', config.ldap.defaultRole, 'active', now, now]
        );
        created++;
      }
    }
    db.scheduleSave();

    const userId = req.user?.userId || '';
    const currentUsername = req.user?.username || '';
    const ip = req.clientIp || req.ip || req.socket.remoteAddress || 'unknown';
    auditLogService.create({ userId, username: currentUsername, action: 'LDAP用户同步', resource: 'users', detail: `从LDAP拉取 ${ldapUsers.length} 个用户，新建 ${created} 个，更新 ${updated} 个`, ip });

    res.json(success({ fetched: ldapUsers.length, created, updated }, `同步完成：拉取 ${ldapUsers.length}，新建 ${created}，更新 ${updated}`));
  });

  /** GET /api/users - 用户列表 */
  router.get('/', (_req: Request, res: Response) => {
    const users = userService.list();
    res.json(success(users));
  });

  /** POST /api/users - 新增用户 */
  router.post('/', (req: Request, res: Response) => {
    const { username, password, realName, cnName, email, role, status } = req.body;

    if (!username?.trim() || !realName?.trim()) {
      res.status(400).json(error(40000, '用户名和真实姓名不能为空'));
      return;
    }

    const userId = req.user?.userId || '';
    const currentUsername = req.user?.username || '';
    const ip = req.clientIp || req.ip || req.socket.remoteAddress || 'unknown';

    const result = userService.create(
      { username: username.trim(), password: password || '123456', realName: realName.trim(), cnName: cnName?.trim() || '', email: email?.trim() || '', role: role || 'user', status: status || 'active' },
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
    const { realName, cnName, email, role, status, password } = req.body;

    const userId = req.user?.userId || '';
    const currentUsername = req.user?.username || '';
    const ip = req.clientIp || req.ip || req.socket.remoteAddress || 'unknown';

    const result = userService.update(
      String(req.params.id),
      { realName, cnName: cnName !== undefined ? String(cnName).trim() : undefined, email: email !== undefined ? String(email).trim() : undefined, role, status, password },
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

    // LDAP账号密码由企业统一认证管理，不允许本地重置
    const target = userService.getById(String(req.params.id));
    if (target?.authSource === 'ldap') {
      res.status(400).json(error(40000, 'LDAP账号密码由企业统一认证（域控）管理，不允许重置'));
      return;
    }

    const reset = userService.resetPassword(String(req.params.id), newPassword, userId, currentUsername, ip);
    if (!reset) {
      res.status(404).json(error(40400, '用户不存在'));
      return;
    }

    res.json(success(null, '密码重置成功'));
  });

  return router;
}
