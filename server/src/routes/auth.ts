import jwt, { SignOptions } from 'jsonwebtoken';
import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Database } from '../database/index.js';
import { AuthService } from '../services/auth.service.js';
import { AuditLogService } from '../services/audit-log.service.js';
import { LdapService } from '../services/ldap.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { success, error } from '../utils/response.js';
import { config } from '../config/index.js';
import { hashPassword } from '../utils/password.js';
import dayjs from 'dayjs';

function getNow(): string { return dayjs().format('YYYY-MM-DD HH:mm:ss'); }

export function createAuthRouter(db: Database): Router {
  const router = Router();
  const auditLogService = new AuditLogService(db);
  const authService = new AuthService(db, auditLogService);
  const ldapService = config.ldap.enabled ? new LdapService() : null;

  /** POST /api/auth/login - 登录（无需鉴权） */
  router.post('/login', async (req: Request, res: Response) => {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json(error(40000, '用户名和密码不能为空'));
      return;
    }

    const ip = req.clientIp || req.ip || req.socket.remoteAddress || 'unknown';

    // 先尝试本地用户登录
    const localResult = authService.login({ username: username.trim(), password, ip });

    if (localResult.success) {
      res.json(success(localResult.data));
      return;
    }

    // 本地登录失败，如果LDAP启用则尝试LDAP
    if (ldapService && config.ldap.enabled) {
      try {
        const ldapUser = await ldapService.authenticate(username.trim(), password);

        if (ldapUser) {
          // LDAP认证成功，检查本地是否已有此用户
          let localUser = db.get('SELECT * FROM users WHERE username = ? AND status = ?', [username.trim(), 'active']) as Record<string, unknown> | undefined;

          if (!localUser) {
            // 自动创建本地用户，默认角色为 LDAP 配置的 defaultRole
            const id = uuidv4();
            const hashedPassword = hashPassword(password);
            const defaultRole = config.ldap.defaultRole;
            const now = getNow();
            db.run(
              'INSERT INTO users (id, username, password, real_name, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
              [id, username.trim(), hashedPassword, ldapUser.displayName, defaultRole, 'active', now, now]
            );
            db.scheduleSave();
            localUser = db.get('SELECT * FROM users WHERE id = ?', [id]) as Record<string, unknown>;
            auditLogService.create({ userId: id, username: username.trim(), action: 'LDAP自动注册', resource: 'auth', detail: `LDAP用户首次登录，自动创建本地账号，角色：${defaultRole}`, ip });
          }

          if (localUser) {
            // 更新本地用户密码（保持同步）和真实姓名
            const now = getNow();
            db.run('UPDATE users SET password = ?, real_name = ?, updated_at = ? WHERE id = ?',
              [hashPassword(password), ldapUser.displayName, now, localUser.id as string]);
            db.scheduleSave();

// LDAP认证成功：生成JWT
            const jwtPayload = {
              userId: localUser.id as string,
              username: localUser.username as string,
              role: localUser.role as string,
            };
            const token = jwt.sign(jwtPayload, config.jwtSecret, { expiresIn: config.accessTokenExpiry } as SignOptions);
            const refreshToken = jwt.sign({ ...jwtPayload, type: 'refresh' }, config.jwtSecret, { expiresIn: config.refreshTokenExpiry } as SignOptions);

            // 清除可能的登录锁定
            db.run('DELETE FROM login_locks WHERE username = ?', [username.trim()]);

            auditLogService.create({ userId: localUser.id as string, username: localUser.username as string, action: 'LDAP登录', resource: 'auth', detail: '用户通过LDAP登录成功', ip });

            const { password: _, ...userWithoutPassword } = (() => {
              const row = db.get('SELECT * FROM users WHERE id = ?', [localUser.id]) as Record<string, unknown>;
              const camel = Object.fromEntries(Object.entries(row).map(([k, v]) => {
                const camelKey = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
                return [camelKey, v];
              }));
              return camel;
            })();

            res.json(success({ token, refreshToken, user: userWithoutPassword }));
            return;
          }
        }
      } catch (ldapErr) {
        console.error('[LDAP] Authentication error:', (ldapErr as Error).message);
      }
    }

    // 所有方式都失败
    const statusCode = localResult.message.includes('锁定') ? 429 : 401;
    const errCode = statusCode === 429 ? 42900 : 40100;
    res.status(statusCode).json(error(errCode, localResult.message));
  });

  /** POST /api/auth/refresh - 刷新Token（无需鉴权） */
  router.post('/refresh', (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json(error(40000, '刷新令牌不能为空'));
      return;
    }

    const result = authService.refreshToken(refreshToken);

    if (!result.success) {
      res.status(401).json(error(40100, result.message));
      return;
    }

    res.json(success(result.data));
  });

  /** GET /api/auth/ldap-status - 查询LDAP是否启用（无需鉴权） */
  router.get('/ldap-status', (_req: Request, res: Response) => {
    res.json(success({ enabled: config.ldap.enabled }));
  });

  // 以下路由需要鉴权
  router.use(authMiddleware);

  /** POST /api/auth/logout - 登出 */
  router.post('/logout', (req: Request, res: Response) => {
    const userId = req.user?.userId || '';
    const username = req.user?.username || '';
    const ip = req.clientIp || req.ip || req.socket.remoteAddress || 'unknown';

    authService.logout(userId, username, ip);
    res.json(success(null, '登出成功'));
  });

  /** PUT /api/auth/password - 修改密码 */
  router.put('/password', (req: Request, res: Response) => {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      res.status(400).json(error(40000, '原密码和新密码不能为空'));
      return;
    }

    const userId = req.user?.userId || '';
    const ip = req.clientIp || req.ip || req.socket.remoteAddress || 'unknown';

    const result = authService.changePassword({
      userId,
      oldPassword,
      newPassword,
      ip,
    });

    if (!result.success) {
      res.status(400).json(error(40000, result.message));
      return;
    }

    res.json(success(null, result.message));
  });

  return router;
}