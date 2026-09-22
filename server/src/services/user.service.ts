import { v4 as uuidv4 } from 'uuid';
import { Database } from '../database/index.js';
import { toCamelCase } from '../utils/mapper.js';
import { hashPassword } from '../utils/password.js';
import { AuditLogService } from './audit-log.service.js';
import dayjs from 'dayjs';

function getNow(): string { return dayjs().format('YYYY-MM-DD HH:mm:ss'); }

export class UserService {
  private db: Database;
  private auditLogService: AuditLogService;
  constructor(db: Database, auditLogService: AuditLogService) { this.db = db; this.auditLogService = auditLogService; }

  /** 排序：本地用户在前，LDAP用户在后，同组内按用户名字母序（不区分大小写） */
  private static ORDER_SQL = "ORDER BY CASE WHEN auth_source = 'local' THEN 0 ELSE 1 END, LOWER(username) ASC";

  list(): Record<string, unknown>[] {
    const rows = this.db.all(`SELECT * FROM users ${UserService.ORDER_SQL}`);
    return rows.map((row) => { const camelRow = toCamelCase(row) as Record<string, unknown>; delete camelRow.password; return camelRow; });
  }

  getById(id: string): Record<string, unknown> | null {
    const row = this.db.get('SELECT * FROM users WHERE id = ?', [id]);
    if (!row) return null;
    const camelRow = toCamelCase(row) as Record<string, unknown>; delete camelRow.password; return camelRow;
  }

  create(data: { username: string; password: string; realName: string; cnName?: string; email?: string; role: string; status: string }, userId: string, username: string, ip: string): Record<string, unknown> | { error: string } {
    const existing = this.db.get('SELECT id FROM users WHERE username = ?', [data.username]);
    if (existing) return { error: '用户名已存在' };
    const id = uuidv4(); const hashedPassword = hashPassword(data.password || '123456'); const now = getNow();
    this.db.run('INSERT INTO users (id, username, password, real_name, cn_name, email, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, data.username, hashedPassword, data.realName, data.cnName || '', data.email || '', data.role, data.status || 'active', now, now]);
    this.auditLogService.create({ userId, username, action: '新增用户', resource: 'users', detail: `新增用户：${data.username}(${data.realName})`, ip });
    this.db.scheduleSave();
    return this.getById(id)!;
  }

  update(id: string, data: { realName?: string; cnName?: string; email?: string; role?: string; status?: string; password?: string }, userId: string, username: string, ip: string): Record<string, unknown> | null {
    const existing = this.getById(id);
    if (!existing) return null;
    const now = getNow();
    if (data.password) {
      const hashedPassword = hashPassword(data.password);
      this.db.run('UPDATE users SET real_name = ?, cn_name = ?, email = ?, role = ?, status = ?, password = ?, updated_at = ? WHERE id = ?', [data.realName ?? existing.realName, data.cnName ?? existing.cnName, data.email ?? existing.email, data.role ?? existing.role, data.status ?? existing.status, hashedPassword, now, id]);
    } else {
      this.db.run('UPDATE users SET real_name = ?, cn_name = ?, email = ?, role = ?, status = ?, updated_at = ? WHERE id = ?', [data.realName ?? existing.realName, data.cnName ?? existing.cnName, data.email ?? existing.email, data.role ?? existing.role, data.status ?? existing.status, now, id]);
    }
    this.auditLogService.create({ userId, username, action: '编辑用户', resource: 'users', detail: `编辑用户：${existing.username}`, ip });
    this.db.scheduleSave();
    return this.getById(id);
  }

  delete(id: string, userId: string, username: string, ip: string): boolean {
    const existing = this.getById(id);
    if (!existing) return false;
    this.db.run('DELETE FROM users WHERE id = ?', [id]);
    this.auditLogService.create({ userId, username, action: '删除用户', resource: 'users', detail: `删除用户：${existing.username}`, ip });
    this.db.scheduleSave();
    return true;
  }

  resetPassword(id: string, newPassword: string, userId: string, username: string, ip: string): boolean {
    const existing = this.getById(id);
    if (!existing) return false;
    const hashedPassword = hashPassword(newPassword); const now = getNow();
    this.db.run('UPDATE users SET password = ?, updated_at = ? WHERE id = ?', [hashedPassword, now, id]);
    this.auditLogService.create({ userId, username, action: '重置密码', resource: 'users', detail: `重置用户密码：${existing.username}`, ip });
    this.db.scheduleSave();
    return true;
  }
}
