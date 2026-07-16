import { v4 as uuidv4 } from 'uuid';
import { Database } from '../database/index.js';
import { InventoryTaskRow, InventoryRecordRow } from '../types/index.js';
import { toCamelCase } from '../utils/mapper.js';
import { AuditLogService } from './audit-log.service.js';
import dayjs from 'dayjs';

function getNow(): string { return dayjs().format('YYYY-MM-DD HH:mm:ss'); }

export class InventoryService {
  private db: Database;
  private auditLogService: AuditLogService;
  constructor(db: Database, auditLogService: AuditLogService) { this.db = db; this.auditLogService = auditLogService; }

  listTasks(): (InventoryTaskRow & { records: InventoryRecordRow[] })[] {
    const tasks = this.db.all('SELECT * FROM inventory_tasks ORDER BY created_at DESC');
    return tasks.map((task) => {
      const records = this.db.all('SELECT * FROM inventory_records WHERE task_id = ? ORDER BY created_at ASC', [task.id]);
      return { ...toCamelCase(task), records: records.map((r) => toCamelCase(r)) } as InventoryTaskRow & { records: InventoryRecordRow[] };
    });
  }

  createTask(params: { name: string; department: string; userId: string; username: string; ip: string }): InventoryTaskRow & { records: InventoryRecordRow[] } {
    const taskId = uuidv4(); const now = getNow();
    const assets = params.department
      ? this.db.all('SELECT * FROM assets WHERE department = ?', [params.department])
      : this.db.all('SELECT * FROM assets');

    this.db.run('INSERT INTO inventory_tasks (id, name, department, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [taskId, params.name, params.department || '全部部门', now, now]);

    const records: InventoryRecordRow[] = [];
    for (const asset of assets) {
      const recordId = uuidv4();
      this.db.run(
        `INSERT INTO inventory_records (id, task_id, asset_id, asset_code, asset_name, department, status, remark, checked_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [recordId, taskId, asset.id, asset.asset_code, asset.name, asset.department, '未盘点', '', '', now, now]
      );
      records.push({ id: recordId, task_id: taskId, asset_id: asset.id as string, asset_code: asset.asset_code as string, asset_name: asset.name as string, department: asset.department as string, status: '未盘点', remark: '', checked_at: '', created_at: now, updated_at: now });
    }

    this.auditLogService.create({ userId: params.userId, username: params.username, action: '创建盘点任务', resource: 'inventory', detail: `创建盘点任务：${params.name}`, ip: params.ip });
    this.db.scheduleSave();
    return { id: taskId, name: params.name, department: params.department || '全部部门', created_at: now, updated_at: now, records };
  }

  updateRecord(params: { taskId: string; recordId: string; status: string; remark: string; userId: string; username: string; ip: string }): InventoryRecordRow | null {
    const existing = this.db.get('SELECT * FROM inventory_records WHERE id = ? AND task_id = ?', [params.recordId, params.taskId]) as Record<string, unknown> | undefined;
    if (!existing) return null;
    const now = getNow();
    const checkedAt = params.status !== '未盘点' ? now : '';
    this.db.run('UPDATE inventory_records SET status = ?, remark = ?, checked_at = ?, updated_at = ? WHERE id = ?', [params.status, params.remark, checkedAt, now, params.recordId]);
    this.auditLogService.create({ userId: params.userId, username: params.username, action: '更新盘点记录', resource: 'inventory', detail: `更新盘点记录：${existing.asset_name} → ${params.status}`, ip: params.ip });
    this.db.scheduleSave();
    const updated = this.db.get('SELECT * FROM inventory_records WHERE id = ?', [params.recordId]);
    return toCamelCase(updated!) as InventoryRecordRow;
  }

  deleteTask(id: string, userId: string, username: string, ip: string): boolean {
    const existing = this.db.get('SELECT * FROM inventory_tasks WHERE id = ?', [id]) as Record<string, unknown> | undefined;
    if (!existing) return false;
    // 级联删除：先删除盘点记录，再删除任务
    this.db.run('DELETE FROM inventory_records WHERE task_id = ?', [id]);
    this.db.run('DELETE FROM inventory_tasks WHERE id = ?', [id]);
    this.auditLogService.create({ userId, username, action: '删除盘点任务', resource: 'inventory', detail: `删除盘点任务：${existing.name}`, ip });
    this.db.scheduleSave();
    return true;
  }
}
