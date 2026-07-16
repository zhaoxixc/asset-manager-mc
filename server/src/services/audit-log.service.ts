import { v4 as uuidv4 } from 'uuid';
import { Database } from '../database/index.js';
import { AuditLogRow } from '../types/index.js';
import { toCamelCase } from '../utils/mapper.js';
import dayjs from 'dayjs';

export class AuditLogService {
  private db: Database;
  constructor(db: Database) { this.db = db; }

  create(params: { userId: string; username: string; action: string; resource: string; detail: string; ip: string }): void {
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    // 清洗IP：去除IPv6映射前缀和本地回环
    let ip = params.ip;
    if (ip.startsWith('::ffff:')) {
      ip = ip.substring(7);
    } else if (ip === '::1') {
      ip = '127.0.0.1';
    }
    this.db.run(
      `INSERT INTO audit_logs (id, user_id, username, action, resource, detail, ip, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), params.userId, params.username, params.action, params.resource, params.detail, ip, now]
    );
    this.db.scheduleSave();
  }

  list(params: { page: number; pageSize: number; action?: string; username?: string; startDate?: string; endDate?: string }): { items: AuditLogRow[]; total: number } {
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (params.action) { conditions.push('action = ?'); values.push(params.action); }
    if (params.username) { conditions.push('username LIKE ?'); values.push(`%${params.username}%`); }
    if (params.startDate) { conditions.push('created_at >= ?'); values.push(params.startDate); }
    if (params.endDate) { conditions.push('created_at <= ?'); values.push(params.endDate); }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRow = this.db.get(`SELECT COUNT(*) as count FROM audit_logs ${whereClause}`, values);
    const total = (countRow?.count as number) || 0;
    const offset = (params.page - 1) * params.pageSize;
    const items = this.db.all(`SELECT * FROM audit_logs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...values, params.pageSize, offset]);
    return { items: items.map((item) => toCamelCase(item) as AuditLogRow), total };
  }

  /** 清理超过指定天数的审计日志，返回删除条数 */
  cleanOldLogs(retentionDays: number = 180): number {
    const cutoff = dayjs().subtract(retentionDays, 'day').format('YYYY-MM-DD HH:mm:ss');
    const countRow = this.db.get('SELECT COUNT(*) as count FROM audit_logs WHERE created_at < ?', [cutoff]);
    const deleted = (countRow?.count as number) || 0;
    if (deleted > 0) {
      this.db.run('DELETE FROM audit_logs WHERE created_at < ?', [cutoff]);
      this.db.scheduleSave();
      console.log(`[AuditLog] Cleaned ${deleted} logs older than ${retentionDays} days`);
    }
    return deleted;
  }
}
