import { v4 as uuidv4 } from 'uuid';
import { Database } from '../database/index.js';
import { DepartmentRow } from '../types/index.js';
import { toCamelCase } from '../utils/mapper.js';
import { AuditLogService } from './audit-log.service.js';
import dayjs from 'dayjs';

function getNow(): string { return dayjs().format('YYYY-MM-DD HH:mm:ss'); }

export class DepartmentService {
  private db: Database;
  private auditLogService: AuditLogService;
  constructor(db: Database, auditLogService: AuditLogService) { this.db = db; this.auditLogService = auditLogService; }

  list(): DepartmentRow[] { return this.db.all('SELECT * FROM departments ORDER BY created_at ASC').map((r) => toCamelCase(r) as DepartmentRow); }

  listWithCount(): (DepartmentRow & { assetCount: number })[] {
    const departments = this.db.all('SELECT * FROM departments ORDER BY created_at ASC').map((r) => toCamelCase(r) as DepartmentRow);
    const counts = this.db.all('SELECT department, COUNT(*) as count FROM assets GROUP BY department');
    const countMap = new Map(counts.map((c) => [c.department as string, c.count as number]));
    return departments.map((d) => ({ ...d, assetCount: countMap.get(d.name) || 0 }));
  }

  getById(id: string): DepartmentRow | null { const r = this.db.get('SELECT * FROM departments WHERE id = ?', [id]); return r ? toCamelCase(r) as DepartmentRow : null; }

  create(name: string, userId: string, username: string, ip: string): DepartmentRow | { error: string } {
    const existing = this.db.get('SELECT id FROM departments WHERE name = ?', [name]);
    if (existing) return { error: '部门名称已存在' };
    const id = uuidv4(); const now = getNow();
    this.db.run('INSERT INTO departments (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)', [id, name, now, now]);
    this.auditLogService.create({ userId, username, action: '新增部门', resource: 'departments', detail: `新增部门：${name}`, ip });
    this.db.scheduleSave();
    return this.getById(id)!;
  }

  update(id: string, name: string, userId: string, username: string, ip: string): DepartmentRow | { error: string } | null {
    const existing = this.getById(id);
    if (!existing) return null;
    const duplicate = this.db.get('SELECT id FROM departments WHERE name = ? AND id != ?', [name, id]);
    if (duplicate) return { error: '部门名称已存在' };
    const oldName = existing.name; const now = getNow();
    this.db.run('UPDATE departments SET name = ?, updated_at = ? WHERE id = ?', [name, now, id]);
    this.db.run(`UPDATE assets SET department = ?, updated_at = ? WHERE department = ?`, [name, now, oldName]);
    this.db.run('UPDATE code_prefixes SET department = ?, updated_at = ? WHERE department = ?', [name, now, oldName]);
    this.auditLogService.create({ userId, username, action: '编辑部门', resource: 'departments', detail: `编辑部门：${oldName} → ${name}`, ip });
    this.db.scheduleSave();
    return this.getById(id);
  }

  delete(id: string, userId: string, username: string, ip: string): boolean {
    const existing = this.getById(id);
    if (!existing) return false;
    const now = getNow();
    this.db.run(`UPDATE assets SET department = '', updated_at = ? WHERE department = ?`, [now, existing.name]);
    this.db.run('DELETE FROM departments WHERE id = ?', [id]);
    this.auditLogService.create({ userId, username, action: '删除部门', resource: 'departments', detail: `删除部门：${existing.name}`, ip });
    this.db.scheduleSave();
    return true;
  }
}
