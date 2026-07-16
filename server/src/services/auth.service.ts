import jwt, { SignOptions } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { Database } from '../database/index.js';
import { config } from '../config/index.js';
import { verifyPassword, hashPassword } from '../utils/password.js';
import { toCamelCase } from '../utils/mapper.js';
import { AuditLogService } from './audit-log.service.js';
import { UserRow, LoginLockRow, JwtPayload } from '../types/index.js';

const MAX_FAIL_COUNT = 5;
const LOCK_DURATION = 5 * 60 * 1000;

import dayjs from 'dayjs';

function getNow(): string { return dayjs().format('YYYY-MM-DD HH:mm:ss'); }

export class AuthService {
  private db: Database;
  private auditLogService: AuditLogService;
  constructor(db: Database, auditLogService: AuditLogService) { this.db = db; this.auditLogService = auditLogService; }

  login(params: { username: string; password: string; ip: string }): { success: boolean; message: string; data?: { token: string; refreshToken: string; user: unknown } } {
    // Check lock
    const lock = this.db.get('SELECT * FROM login_locks WHERE username = ?', [params.username]) as Record<string, unknown> | undefined;
    if (lock?.locked_until) {
      const lockedUntil = new Date(lock.locked_until as string).getTime();
      if (Date.now() < lockedUntil) {
        const remaining = Math.ceil((lockedUntil - Date.now()) / 60000);
        return { success: false, message: `账户已被锁定，请 ${remaining} 分钟后重试` };
      }
    }

    // Find user
    const user = this.db.get('SELECT * FROM users WHERE username = ? AND status = ?', [params.username, 'active']) as Record<string, unknown> | undefined;
    if (!user) {
      this.incrementFailCount(params.username);
      if (this.getFailCount(params.username) >= MAX_FAIL_COUNT) return { success: false, message: `连续失败${MAX_FAIL_COUNT}次，账户已锁定5分钟` };
      return { success: false, message: '用户名或密码错误' };
    }

    // Verify password
    if (!verifyPassword(params.password, user.password as string)) {
      this.incrementFailCount(params.username);
      if (this.getFailCount(params.username) >= MAX_FAIL_COUNT) return { success: false, message: `连续失败${MAX_FAIL_COUNT}次，账户已锁定5分钟` };
      return { success: false, message: '用户名或密码错误' };
    }

    // Success: clear lock
    this.clearLock(params.username);

    // Issue JWT
    const payload: JwtPayload = { userId: user.id as string, username: user.username as string, role: user.role as string };
    const token = jwt.sign(payload, config.jwtSecret, { expiresIn: config.accessTokenExpiry } as SignOptions);
    const refreshToken = jwt.sign({ ...payload, type: 'refresh' }, config.jwtSecret, { expiresIn: config.refreshTokenExpiry } as SignOptions);

    this.auditLogService.create({ userId: user.id as string, username: user.username as string, action: '登录', resource: 'auth', detail: '用户登录成功', ip: params.ip });

    // Remove password from user object before sending
    const { password: _, ...userWithoutPassword } = toCamelCase(user) as Record<string, unknown>;

    return { success: true, message: '登录成功', data: { token, refreshToken, user: userWithoutPassword } };
  }

  logout(userId: string, username: string, ip: string): void {
    this.auditLogService.create({ userId, username, action: '登出', resource: 'auth', detail: '用户登出', ip });
  }

  refreshToken(refreshTokenStr: string): { success: boolean; message: string; data?: { token: string; refreshToken: string } } {
    try {
      const decoded = jwt.verify(refreshTokenStr, config.jwtSecret) as JwtPayload;
      if (decoded.type !== 'refresh') return { success: false, message: '无效的刷新令牌' };
      const payload: JwtPayload = { userId: decoded.userId, username: decoded.username, role: decoded.role };
      const newToken = jwt.sign(payload, config.jwtSecret, { expiresIn: config.accessTokenExpiry } as SignOptions);
      const newRefreshToken = jwt.sign({ ...payload, type: 'refresh' }, config.jwtSecret, { expiresIn: config.refreshTokenExpiry } as SignOptions);
      return { success: true, message: '刷新成功', data: { token: newToken, refreshToken: newRefreshToken } };
    } catch {
      return { success: false, message: '刷新令牌无效或已过期' };
    }
  }

  changePassword(params: { userId: string; oldPassword: string; newPassword: string; ip: string }): { success: boolean; message: string } {
    const user = this.db.get('SELECT * FROM users WHERE id = ?', [params.userId]) as Record<string, unknown> | undefined;
    if (!user) return { success: false, message: '用户不存在' };
    if (!verifyPassword(params.oldPassword, user.password as string)) return { success: false, message: '原密码不正确' };
    if (params.newPassword.length < 6) return { success: false, message: '新密码长度不能少于6位' };
    const hashedNewPassword = hashPassword(params.newPassword);
    const now = getNow();
    this.db.run('UPDATE users SET password = ?, updated_at = ? WHERE id = ?', [hashedNewPassword, now, params.userId]);
    this.db.scheduleSave();
    this.auditLogService.create({ userId: params.userId, username: user.username as string, action: '修改密码', resource: 'auth', detail: '用户修改密码', ip: params.ip });
    return { success: true, message: '密码修改成功' };
  }

  private incrementFailCount(username: string): void {
    const now = getNow();
    const existing = this.db.get('SELECT * FROM login_locks WHERE username = ?', [username]) as Record<string, unknown> | undefined;
    if (existing) {
      const newCount = (existing.fail_count as number) + 1;
      const lockedUntil = newCount >= MAX_FAIL_COUNT ? dayjs().add(LOCK_DURATION, 'millisecond').format('YYYY-MM-DD HH:mm:ss') : null;
      this.db.run('UPDATE login_locks SET fail_count = ?, locked_until = ?, updated_at = ? WHERE username = ?', [newCount, lockedUntil, now, username]);
    } else {
      const lockedUntil = 1 >= MAX_FAIL_COUNT ? dayjs().add(LOCK_DURATION, 'millisecond').format('YYYY-MM-DD HH:mm:ss') : null;
      this.db.run('INSERT INTO login_locks (id, username, fail_count, locked_until, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [uuidv4(), username, 1, lockedUntil, now, now]);
    }
    this.db.scheduleSave();
  }

  private getFailCount(username: string): number {
    const lock = this.db.get('SELECT fail_count FROM login_locks WHERE username = ?', [username]) as Record<string, unknown> | undefined;
    return (lock?.fail_count as number) || 0;
  }

  private clearLock(username: string): void {
    this.db.run('DELETE FROM login_locks WHERE username = ?', [username]);
    this.db.scheduleSave();
  }
}
