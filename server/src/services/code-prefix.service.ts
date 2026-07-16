import { v4 as uuidv4 } from 'uuid';
import { Database } from '../database/index.js';
import { toCamelCase } from '../utils/mapper.js';
import { AuditLogService } from './audit-log.service.js';
import dayjs from 'dayjs';

function getNow(): string { return dayjs().format('YYYY-MM-DD HH:mm:ss'); }

export class CodePrefixService {
  private db: Database;
  private auditLogService: AuditLogService;
  constructor(db: Database, auditLogService: AuditLogService) { this.db = db; this.auditLogService = auditLogService; }

  list(): Record<string, unknown>[] {
    return this.db.all('SELECT * FROM code_prefixes ORDER BY created_at ASC').map((r) => toCamelCase(r));
  }

  create(department: string, prefix: string, suffix: string, numberWidth: number, userId: string, username: string, ip: string): Record<string, unknown> | { error: string } {
    const existing = this.db.get('SELECT id FROM code_prefixes WHERE prefix = ? AND suffix = ?', [prefix, suffix]);
    if (existing) return { error: '编号前缀+后缀组合已存在' };
    if (numberWidth < 3 || numberWidth > 8) return { error: '序号位数必须在3-8之间' };
    const id = uuidv4();
    const now = getNow();
    this.db.run('INSERT INTO code_prefixes (id, department, prefix, suffix, number_width, last_seq, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)', [id, department, prefix, suffix, numberWidth, now, now]);
    this.auditLogService.create({ userId, username, action: '新增编号前缀', resource: 'code-prefixes', detail: `新增编号前缀：${prefix}${suffix}(${department})`, ip });
    this.db.scheduleSave();
    const result = this.db.get('SELECT * FROM code_prefixes WHERE id = ?', [id]);
    return toCamelCase(result!);
  }

  update(id: string, department: string, prefix: string, suffix: string, numberWidth: number, userId: string, username: string, ip: string): Record<string, unknown> | { error: string } | null {
    const existing = this.db.get('SELECT * FROM code_prefixes WHERE id = ?', [id]);
    if (!existing) return null;
    const duplicate = this.db.get('SELECT id FROM code_prefixes WHERE prefix = ? AND suffix = ? AND id != ?', [prefix, suffix, id]);
    if (duplicate) return { error: '编号前缀+后缀组合已存在' };
    if (numberWidth < 3 || numberWidth > 8) return { error: '序号位数必须在3-8之间' };
    const now = getNow();
    this.db.run('UPDATE code_prefixes SET department = ?, prefix = ?, suffix = ?, number_width = ?, updated_at = ? WHERE id = ?', [department, prefix, suffix, numberWidth, now, id]);
    this.auditLogService.create({ userId, username, action: '编辑编号前缀', resource: 'code-prefixes', detail: `编辑编号前缀：${prefix}${suffix}(${department})`, ip });
    this.db.scheduleSave();
    const result = this.db.get('SELECT * FROM code_prefixes WHERE id = ?', [id]);
    return toCamelCase(result!);
  }

  delete(id: string, userId: string, username: string, ip: string): boolean {
    const existing = this.db.get('SELECT * FROM code_prefixes WHERE id = ?', [id]);
    if (!existing) return false;
    this.db.run('DELETE FROM code_prefixes WHERE id = ?', [id]);
    this.auditLogService.create({ userId, username, action: '删除编号前缀', resource: 'code-prefixes', detail: `删除编号前缀`, ip });
    this.db.scheduleSave();
    return true;
  }

  generateNextCode(prefix: string, suffix: string = ''): string {
    let prefixRow = this.db.get('SELECT * FROM code_prefixes WHERE prefix = ? AND suffix = ?', [prefix, suffix]);
    if (!prefixRow) {
      const id = uuidv4();
      const now2 = getNow();
      this.db.run('INSERT INTO code_prefixes (id, department, prefix, suffix, number_width, last_seq, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)', [id, '', prefix, suffix, 4, now2, now2]);
      this.db.scheduleSave();
      prefixRow = this.db.get('SELECT * FROM code_prefixes WHERE prefix = ? AND suffix = ?', [prefix, suffix]);
    }
    const numberWidth = (prefixRow!.number_width as number) || 4;
    const maxSeq = Math.pow(10, numberWidth) - 1;
    let seq = ((prefixRow!.last_seq as number) || 0) + 1;

    if (seq > maxSeq) {
      seq = 1;
    }

    let assetCode = `${prefix}${suffix}${String(seq).padStart(numberWidth, '0')}`;
    let tried = 0;
    while (this.db.get('SELECT id FROM assets WHERE asset_code = ?', [assetCode])) {
      seq++;
      if (seq > maxSeq) {
        seq = 1;
      }
      tried++;
      if (tried > maxSeq) {
        throw new Error(`编号序列已用尽（前缀: ${prefix}${suffix}，位数: ${numberWidth}），请增加序号位数或联系管理员`);
      }
      assetCode = `${prefix}${suffix}${String(seq).padStart(numberWidth, '0')}`;
    }
    const now = getNow();
    this.db.run('UPDATE code_prefixes SET last_seq = ?, updated_at = ? WHERE id = ?', [seq, now, prefixRow!.id]);
    this.db.scheduleSave();
    return assetCode;
  }
}