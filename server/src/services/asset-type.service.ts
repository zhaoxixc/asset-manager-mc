import { v4 as uuidv4 } from 'uuid';
import { Database } from '../database/index.js';
import { toCamelCase } from '../utils/mapper.js';
import { AuditLogService } from './audit-log.service.js';
import dayjs from 'dayjs';

function getNow(): string { return dayjs().format('YYYY-MM-DD HH:mm:ss'); }

/** 资产类型行类型 */
interface AssetTypeRow {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export class AssetTypeService {
  private db: Database;
  private auditLogService: AuditLogService;
  constructor(db: Database, auditLogService: AuditLogService) { this.db = db; this.auditLogService = auditLogService; }

  /** 获取所有资产类型，按创建时间升序排列 */
  list(): AssetTypeRow[] {
    return this.db.all('SELECT * FROM asset_types ORDER BY created_at ASC').map((r) => toCamelCase(r) as AssetTypeRow);
  }

  /** 获取所有资产类型，附带每个类型的资产数量 */
  listWithCount(): (AssetTypeRow & { assetCount: number })[] {
    const types = this.db.all('SELECT * FROM asset_types ORDER BY created_at ASC').map((r) => toCamelCase(r) as AssetTypeRow);
    const counts = this.db.all('SELECT type, COUNT(*) as count FROM assets GROUP BY type');
    const countMap = new Map(counts.map((c) => [c.type as string, c.count as number]));
    return types.map((t) => ({ ...t, assetCount: countMap.get(t.name) || 0 }));
  }

  /** 根据ID获取资产类型 */
  getById(id: string): AssetTypeRow | null {
    const r = this.db.get('SELECT * FROM asset_types WHERE id = ?', [id]);
    return r ? toCamelCase(r) as AssetTypeRow : null;
  }

  /** 新增资产类型 */
  create(name: string, userId: string, username: string, ip: string): AssetTypeRow | { error: string } {
    const existing = this.db.get('SELECT id FROM asset_types WHERE name = ?', [name]);
    if (existing) return { error: '资产类型名称已存在' };
    const id = uuidv4();
    const now = getNow();
    this.db.run('INSERT INTO asset_types (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)', [id, name, now, now]);
    this.auditLogService.create({ userId, username, action: '新增资产类型', resource: 'asset-types', detail: `新增资产类型：${name}`, ip });
    this.db.scheduleSave();
    return this.getById(id)!;
  }

  /** 更新资产类型 */
  update(id: string, name: string, userId: string, username: string, ip: string): AssetTypeRow | { error: string } | null {
    const existing = this.getById(id);
    if (!existing) return null;
    const duplicate = this.db.get('SELECT id FROM asset_types WHERE name = ? AND id != ?', [name, id]);
    if (duplicate) return { error: '资产类型名称已存在' };
    const oldName = existing.name;
    const now = getNow();
    this.db.run('UPDATE asset_types SET name = ?, updated_at = ? WHERE id = ?', [name, now, id]);
    // 同步更新所有引用该类型的资产
    this.db.run('UPDATE assets SET type = ?, updated_at = ? WHERE type = ?', [name, now, oldName]);
    this.auditLogService.create({ userId, username, action: '编辑资产类型', resource: 'asset-types', detail: `编辑资产类型：${oldName} → ${name}`, ip });
    this.db.scheduleSave();
    return this.getById(id);
  }

  /** 删除资产类型 */
  delete(id: string, userId: string, username: string, ip: string): boolean {
    const existing = this.getById(id);
    if (!existing) return false;
    const now = getNow();
    // 将引用该类型的资产的type字段设为空
    this.db.run('UPDATE assets SET type = \'\', updated_at = ? WHERE type = ?', [now, existing.name]);
    this.db.run('DELETE FROM asset_types WHERE id = ?', [id]);
    this.auditLogService.create({ userId, username, action: '删除资产类型', resource: 'asset-types', detail: `删除资产类型：${existing.name}`, ip });
    this.db.scheduleSave();
    return true;
  }
}
