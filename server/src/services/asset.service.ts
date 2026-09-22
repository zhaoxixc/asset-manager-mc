import { v4 as uuidv4 } from 'uuid';
import { Database } from '../database/index.js';
import { AssetRow, ChangeLogRow } from '../types/index.js';
import { toCamelCase } from '../utils/mapper.js';
import { AuditLogService } from './audit-log.service.js';
import { CodePrefixService } from './code-prefix.service.js';
import dayjs from 'dayjs';

function parseJsonArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === 'string') {
    try { const p = JSON.parse(val); return Array.isArray(p) ? p.map(String) : []; } catch { return val ? [val] : []; }
  }
  return [];
}

function stringifyArray(val: unknown): string {
  return JSON.stringify(parseJsonArray(val));
}

function getNow(): string { return dayjs().format('YYYY-MM-DD HH:mm:ss'); }

function toAssetResponse(row: Record<string, unknown>): AssetRow {
  const asset = toCamelCase(row) as AssetRow & {
    wiredMacs?: unknown;
    wirelessMacs?: unknown;
    hostnames?: unknown;
  };
  asset.wiredMacs = parseJsonArray(asset.wiredMacs);
  asset.wirelessMacs = parseJsonArray(asset.wirelessMacs);
  asset.hostnames = parseJsonArray(asset.hostnames);
  return asset;
}

/** 动态解析使用人与登录用户的关联（存储的owner_username为空时，按 cn_name → real_name → username 匹配启用用户） */
function enrichOwnerUsername(db: Database, rows: Record<string, unknown>[]): void {
  const pending = rows.filter((r) => !r.owner_username && r.user);
  if (pending.length === 0) return;
  const users = db.all("SELECT username, real_name, cn_name FROM users WHERE status = 'active'");
  const byCn = new Map<string, string>();
  const byReal = new Map<string, string>();
  const byUsername = new Map<string, string>();
  for (const u of users) {
    const username = String(u.username);
    byUsername.set(username, username);
    if (u.cn_name) byCn.set(String(u.cn_name), username);
    if (u.real_name) byReal.set(String(u.real_name), username);
  }
  for (const r of pending) {
    const name = String(r.user);
    r.owner_username = byCn.get(name) || byReal.get(name) || byUsername.get(name) || '';
  }
}

export class AssetService {
  private db: Database;
  private auditLogService: AuditLogService;
  private codePrefixService: CodePrefixService;
  constructor(db: Database, auditLogService: AuditLogService) { this.db = db; this.auditLogService = auditLogService; this.codePrefixService = new CodePrefixService(db, auditLogService); }

  list(params: { page: number; pageSize: number; keyword?: string; user?: string; type?: string; department?: string; status?: string; location?: string; sortBy?: string; sortOrder?: string }): { items: AssetRow[]; total: number } {
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (params.keyword) { conditions.push('(name LIKE ? OR asset_code LIKE ? OR "user" LIKE ? OR remark LIKE ? OR wired_macs LIKE ? OR wireless_macs LIKE ? OR hostnames LIKE ?)'); const kw = `%${params.keyword}%`; values.push(kw, kw, kw, kw, kw, kw, kw); }
    if (params.user) { conditions.push('"user" = ?'); values.push(params.user); }
    if (params.type) { conditions.push('type = ?'); values.push(params.type); }
    if (params.department) { conditions.push('department = ?'); values.push(params.department); }
    if (params.status) { conditions.push('status = ?'); values.push(params.status); }
    if (params.location) { conditions.push('location LIKE ?'); values.push(`%${params.location}%`); }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    // 支持camelCase和snake_case的排序字段映射
    const sortFieldMap: Record<string, string> = {
      'createdAt': 'created_at', 'updatedAt': 'updated_at',
      'assetCode': 'asset_code', 'purchaseDate': 'purchase_date',
      'name': 'name', 'created_at': 'created_at', 'updated_at': 'updated_at',
      'asset_code': 'asset_code', 'purchase_date': 'purchase_date',
    };
    const allowedSortFields = Object.values(sortFieldMap);
    const mappedSortBy = sortFieldMap[params.sortBy || ''] || 'created_at';
    const sortBy = allowedSortFields.includes(mappedSortBy) ? mappedSortBy : 'created_at';
    const sortOrder = params.sortOrder === 'asc' ? 'ASC' : 'DESC';
    const countRow = this.db.get(`SELECT COUNT(*) as count FROM assets ${whereClause}`, values);
    const total = (countRow?.count as number) || 0;
    const offset = (params.page - 1) * params.pageSize;
    const items = this.db.all(`SELECT * FROM assets ${whereClause} ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`, [...values, params.pageSize, offset]);
    enrichOwnerUsername(this.db, items);
    return { items: items.map(toAssetResponse), total };
  }

  getById(id: string): AssetRow | null {
    const row = this.db.get('SELECT * FROM assets WHERE id = ?', [id]);
    return row ? toAssetResponse(row) : null;
  }

  /**
   * 解析部门对应的编号前缀配置
   * 优先级：部门精确匹配 → 部门为空的全局默认配置 → 硬编码ZC
   */
  private resolvePrefixConfig(department: string): { prefix: string; suffix: string } {
    const row = this.db.get('SELECT prefix, suffix FROM code_prefixes WHERE department = ?', [department]) as Record<string, unknown> | undefined;
    if (row) return { prefix: String(row.prefix), suffix: String(row.suffix || '') };
    const def = this.db.get("SELECT prefix, suffix FROM code_prefixes WHERE department = ''") as Record<string, unknown> | undefined;
    if (def) return { prefix: String(def.prefix), suffix: String(def.suffix || '') };
    return { prefix: 'ZC', suffix: '' };
  }

  create(data: Record<string, unknown>, userId: string, username: string, ip: string): AssetRow {
    // 资产编号：如果提供了则使用，否则根据前缀自动生成
    let assetCode = String(data.assetCode || '').trim();
    if (!assetCode) {
      // 自动生成：根据部门匹配前缀+后缀，未匹配则使用全局默认
      const { prefix, suffix } = this.resolvePrefixConfig(String(data.department || ''));
      assetCode = this.codePrefixService.generateNextCode(prefix, suffix);
    } else {
      // 手动输入时校验唯一性
      const existing = this.db.get('SELECT id FROM assets WHERE asset_code = ?', [assetCode]);
      if (existing) {
        throw new Error('资产编号已存在');
      }
    }
    const id = uuidv4();
    const now = getNow();
    const wiredMacs = stringifyArray(data.wiredMacs);
    const wirelessMacs = stringifyArray(data.wirelessMacs);
    const hostnames = stringifyArray(data.hostnames);
    this.db.run(
      `INSERT INTO assets (id, asset_code, name, type, model, department, "user", owner_username, purchase_date, status, location, remark, wired_macs, wireless_macs, hostnames, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, assetCode, data.name || '', data.type || '其他', data.model || '', data.department || '', data.user || '', data.ownerUsername || '', data.purchaseDate || '', data.status || '在用', data.location || '', data.remark || '', wiredMacs, wirelessMacs, hostnames, now, now]
    );
    this.addChangeLog(assetCode, String(data.name), '新增', `新增资产：${data.name}`);
    this.auditLogService.create({ userId, username, action: '新增资产', resource: 'assets', detail: `新增资产：${data.name}(${assetCode})`, ip });
    this.db.scheduleSave();
    return this.getById(id)!;
  }

  update(id: string, data: Record<string, unknown>, userId: string, username: string, ip: string): AssetRow | null {
    const existing = this.db.get('SELECT * FROM assets WHERE id = ?', [id]) as Record<string, unknown> | undefined;
    if (!existing) return null;
    const now = getNow();
    const wiredMacs = stringifyArray(data.wiredMacs ?? existing.wired_macs);
    const wirelessMacs = stringifyArray(data.wirelessMacs ?? existing.wireless_macs);
    const hostnames = stringifyArray(data.hostnames ?? existing.hostnames);
    this.db.run(
      `UPDATE assets SET name = ?, type = ?, model = ?, department = ?, "user" = ?, owner_username = ?, purchase_date = ?, status = ?, location = ?, remark = ?, wired_macs = ?, wireless_macs = ?, hostnames = ?, updated_at = ? WHERE id = ?`,
      [String(data.name ?? existing.name), String(data.type ?? existing.type), String(data.model ?? existing.model), String(data.department ?? existing.department), String(data.user ?? existing.user), String(data.ownerUsername ?? existing.owner_username ?? ''), String(data.purchaseDate ?? existing.purchase_date), String(data.status ?? existing.status), String(data.location ?? existing.location), String(data.remark ?? existing.remark), wiredMacs, wirelessMacs, hostnames, now, id]
    );
    if (existing.status !== String(data.status ?? existing.status)) {
      this.addChangeLog(existing.asset_code as string, String(data.name ?? existing.name), '状态变更', `状态从"${existing.status}"变为"${data.status ?? existing.status}"`);
    } else {
      this.addChangeLog(existing.asset_code as string, String(data.name ?? existing.name), '编辑', `编辑资产：${data.name ?? existing.name}`);
    }
    this.auditLogService.create({ userId, username, action: '编辑资产', resource: 'assets', detail: `编辑资产：${data.name ?? existing.name}(${existing.asset_code})`, ip });
    this.db.scheduleSave();
    return this.getById(id);
  }

  delete(id: string, userId: string, username: string, ip: string): boolean {
    const existing = this.db.get('SELECT * FROM assets WHERE id = ?', [id]) as Record<string, unknown> | undefined;
    if (!existing) return false;
    this.db.run('DELETE FROM assets WHERE id = ?', [id]);
    this.addChangeLog(existing.asset_code as string, existing.name as string, '删除', `删除资产：${existing.name}`);
    this.auditLogService.create({ userId, username, action: '删除资产', resource: 'assets', detail: `删除资产：${existing.name}(${existing.asset_code})`, ip });
    this.db.scheduleSave();
    return true;
  }

  batchDelete(ids: string[], userId: string, username: string, ip: string): { deleted: number } {
    const placeholders = ids.map(() => '?').join(',');
    const assets = this.db.all(`SELECT * FROM assets WHERE id IN (${placeholders})`, ids);
    this.db.run(`DELETE FROM assets WHERE id IN (${placeholders})`, ids);
    for (const asset of assets) { this.addChangeLog(asset.asset_code as string, asset.name as string, '删除', `批量删除资产：${asset.name}`); }
    this.auditLogService.create({ userId, username, action: '批量删除资产', resource: 'assets', detail: `批量删除 ${assets.length} 条资产`, ip });
    this.db.scheduleSave();
    return { deleted: assets.length };
  }

  import(dataList: Record<string, unknown>[], userId: string, username: string, ip: string): { success: number; fail: number; errors: string[] } {
    let success = 0; let fail = 0; const errors: string[] = [];
    this.db.transaction(() => {
      for (let i = 0; i < dataList.length; i++) {
        const data = dataList[i];
        if (!data.name) { fail++; errors.push(`第${i + 1}行：资产名称不能为空`); continue; }
        if (!data.type) { fail++; errors.push(`第${i + 1}行：资产类型不能为空`); continue; }
        if (!data.status) { fail++; errors.push(`第${i + 1}行：资产状态不能为空`); continue; }
        try {
          const id = uuidv4();
          // 导入时如果提供了assetCode则使用，否则自动生成
          let assetCode = String(data.assetCode || '').trim();
          if (!assetCode) {
            const { prefix, suffix } = this.resolvePrefixConfig(String(data.department || ''));
            assetCode = this.codePrefixService.generateNextCode(prefix, suffix);
          } else {
            // 如果提供了assetCode，校验唯一性
            const existing = this.db.get('SELECT id FROM assets WHERE asset_code = ?', [assetCode]);
            if (existing) {
              fail++; errors.push(`第${i + 1}行：资产编号"${assetCode}"已存在`); continue;
            }
          }
          const now = getNow();
          const wiredMacs = stringifyArray(data.wiredMacs);
          const wirelessMacs = stringifyArray(data.wirelessMacs);
          const hostnames = stringifyArray(data.hostnames);
          // 归属用户：优先使用导入数据提供的值，否则按使用人姓名自动匹配（cn_name → real_name → username）
          let ownerUsername = String(data.ownerUsername || '').trim();
          const userName = String(data.user || '').trim();
          if (!ownerUsername && userName) {
            const findUserBy = (col: 'cn_name' | 'real_name' | 'username'): string => {
              const row = this.db.get(`SELECT username FROM users WHERE status = 'active' AND ${col} = ?`, [userName]) as Record<string, unknown> | undefined;
              return row ? String(row.username) : '';
            };
            ownerUsername = findUserBy('cn_name') || findUserBy('real_name') || findUserBy('username');
          }
          this.db.run(`INSERT INTO assets (id, asset_code, name, type, model, department, "user", owner_username, purchase_date, status, location, remark, wired_macs, wireless_macs, hostnames, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, assetCode, String(data.name), String(data.type), String(data.model || ''), String(data.department || ''), String(data.user || ''), ownerUsername, String(data.purchaseDate || ''), String(data.status), String(data.location || ''), String(data.remark || ''), wiredMacs, wirelessMacs, hostnames, now, now]);
          this.addChangeLog(assetCode, String(data.name), '新增', `导入资产：${data.name}`);
          success++;
        } catch (err) { fail++; errors.push(`第${i + 1}行：导入失败 - ${(err as Error).message}`); }
      }
    });
    this.auditLogService.create({ userId, username, action: '导入资产', resource: 'assets', detail: `导入资产：成功${success}条，失败${fail}条`, ip });
    return { success, fail, errors };
  }

  listAll(params?: { keyword?: string; user?: string; type?: string; department?: string; status?: string; location?: string; sortBy?: string; sortOrder?: string }): AssetRow[] {
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (params?.keyword) { conditions.push('(name LIKE ? OR asset_code LIKE ? OR "user" LIKE ? OR remark LIKE ? OR wired_macs LIKE ? OR wireless_macs LIKE ? OR hostnames LIKE ?)'); const kw = `%${params.keyword}%`; values.push(kw, kw, kw, kw, kw, kw, kw); }
    if (params?.user) { conditions.push('"user" = ?'); values.push(params.user); }
    if (params?.type) { conditions.push('type = ?'); values.push(params.type); }
    if (params?.department) { conditions.push('department = ?'); values.push(params.department); }
    if (params?.status) { conditions.push('status = ?'); values.push(params.status); }
    if (params?.location) { conditions.push('location LIKE ?'); values.push(`%${params.location}%`); }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sortFieldMap: Record<string, string> = {
      'createdAt': 'created_at', 'updatedAt': 'updated_at',
      'assetCode': 'asset_code', 'purchaseDate': 'purchase_date',
      'name': 'name', 'created_at': 'created_at', 'updated_at': 'updated_at',
      'asset_code': 'asset_code', 'purchase_date': 'purchase_date',
    };
    const allowedSortFields = Object.values(sortFieldMap);
    const mappedSortBy = sortFieldMap[params?.sortBy || ''] || 'created_at';
    const sortBy = allowedSortFields.includes(mappedSortBy) ? mappedSortBy : 'created_at';
    const sortOrder = params?.sortOrder === 'asc' ? 'ASC' : 'DESC';
    const items = this.db.all(`SELECT * FROM assets ${whereClause} ORDER BY ${sortBy} ${sortOrder}`, values);
    enrichOwnerUsername(this.db, items);
    return items.map(toAssetResponse);
  }

  getChangeLogs(params: { page: number; pageSize: number; assetCode?: string }): { items: ChangeLogRow[]; total: number } {
    const conditions: string[] = []; const values: unknown[] = [];
    if (params.assetCode) { conditions.push('asset_code = ?'); values.push(params.assetCode); }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRow = this.db.get(`SELECT COUNT(*) as count FROM change_logs ${whereClause}`, values);
    const total = (countRow?.count as number) || 0;
    const offset = (params.page - 1) * params.pageSize;
    const items = this.db.all(`SELECT * FROM change_logs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...values, params.pageSize, offset]);
    return { items: items.map((item) => toCamelCase(item) as ChangeLogRow), total };
  }

  private addChangeLog(assetCode: string, assetName: string, action: string, detail: string): void {
    const now = getNow();
    this.db.run(`INSERT INTO change_logs (id, asset_code, asset_name, action, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)`, [uuidv4(), assetCode, assetName, action, detail, now]);
  }
}
