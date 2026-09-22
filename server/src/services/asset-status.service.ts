import { v4 as uuidv4 } from 'uuid';
import { Database } from '../database/index.js';
import { AssetStatusRow } from '../types/index.js';
import { toCamelCase } from '../utils/mapper.js';
import { AuditLogService } from './audit-log.service.js';
import dayjs from 'dayjs';

function getNow(): string { return dayjs().format('YYYY-MM-DD HH:mm:ss'); }

export class AssetStatusService {
  private db: Database;
  private auditLogService: AuditLogService;
  constructor(db: Database, auditLogService: AuditLogService) { this.db = db; this.auditLogService = auditLogService; }

  list(): AssetStatusRow[] {
    return this.db.all('SELECT * FROM asset_statuses ORDER BY sort_order, created_at ASC').map((r) => toCamelCase(r) as AssetStatusRow);
  }

  listWithCount(): (AssetStatusRow & { assetCount: number })[] {
    const statuses = this.db.all('SELECT * FROM asset_statuses ORDER BY sort_order, created_at ASC').map((r) => toCamelCase(r) as AssetStatusRow);
    const counts = this.db.all('SELECT status, COUNT(*) as count FROM assets GROUP BY status');
    const countMap = new Map(counts.map((c) => [c.status as string, c.count as number]));
    return statuses.map((s) => ({ ...s, assetCount: countMap.get(s.name) || 0 }));
  }

  /** 上移/下移排序：与相邻状态交换 sort_order */
  reorder(id: string, direction: 'up' | 'down'): boolean {
    const list = this.db.all('SELECT id, sort_order FROM asset_statuses ORDER BY sort_order, created_at');
    const idx = list.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= list.length) return false;
    const a = list[idx];
    const b = list[swapIdx];
    this.db.run('UPDATE asset_statuses SET sort_order = ?, updated_at = ? WHERE id = ?', [b.sort_order || swapIdx + 1, getNow(), a.id]);
    this.db.run('UPDATE asset_statuses SET sort_order = ?, updated_at = ? WHERE id = ?', [a.sort_order || idx + 1, getNow(), b.id]);
    this.db.scheduleSave();
    return true;
  }

  getById(id: string): AssetStatusRow | null {
    const r = this.db.get('SELECT * FROM asset_statuses WHERE id = ?', [id]);
    return r ? toCamelCase(r) as AssetStatusRow : null;
  }

  create(name: string, color: string, userId: string, username: string, ip: string): AssetStatusRow | { error: string } {
    const existing = this.db.get('SELECT id FROM asset_statuses WHERE name = ?', [name]);
    if (existing) return { error: '资产状态名称已存在' };
    const id = uuidv4();
    const now = getNow();
    const maxRow = this.db.get('SELECT COALESCE(MAX(sort_order), 0) AS m FROM asset_statuses') as Record<string, unknown> | undefined;
    const sortOrder = ((maxRow?.m as number) || 0) + 1;
    this.db.run('INSERT INTO asset_statuses (id, name, color, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [id, name, color || '#757575', sortOrder, now, now]);
    this.auditLogService.create({ userId, username, action: '新增资产状态', resource: 'asset-statuses', detail: `新增资产状态：${name}`, ip });
    this.db.scheduleSave();
    return this.getById(id)!;
  }

  update(id: string, name: string, color: string, userId: string, username: string, ip: string): AssetStatusRow | { error: string } | null {
    const existing = this.getById(id);
    if (!existing) return null;
    const duplicate = this.db.get('SELECT id FROM asset_statuses WHERE name = ? AND id != ?', [name, id]);
    if (duplicate) return { error: '资产状态名称已存在' };
    const oldName = existing.name;
    const now = getNow();
    this.db.run('UPDATE asset_statuses SET name = ?, color = ?, updated_at = ? WHERE id = ?', [name, color || existing.color, now, id]);
    this.db.run('UPDATE assets SET status = ?, updated_at = ? WHERE status = ?', [name, now, oldName]);
    // 同步更新盘点记录中异常引用
    this.db.run('UPDATE inventory_records SET status = ? WHERE status = ?', [name, oldName]);
    this.auditLogService.create({ userId, username, action: '编辑资产状态', resource: 'asset-statuses', detail: `编辑资产状态：${oldName} → ${name}`, ip });
    this.db.scheduleSave();
    return this.getById(id);
  }

  delete(id: string, userId: string, username: string, ip: string): boolean {
    const existing = this.getById(id);
    if (!existing) return false;
    const now = getNow();
    this.db.run('UPDATE assets SET status = ?, updated_at = ? WHERE status = ?', ['', now, existing.name]);
    this.db.run('DELETE FROM asset_statuses WHERE id = ?', [id]);
    this.auditLogService.create({ userId, username, action: '删除资产状态', resource: 'asset-statuses', detail: `删除资产状态：${existing.name}`, ip });
    this.db.scheduleSave();
    return true;
  }
}