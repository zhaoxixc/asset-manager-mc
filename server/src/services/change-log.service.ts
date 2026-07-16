import { Database } from '../database/index.js';
import { ChangeLogRow } from '../types/index.js';
import { toCamelCase } from '../utils/mapper.js';

export class ChangeLogService {
  private db: Database;
  constructor(db: Database) { this.db = db; }

  list(params: { page: number; pageSize: number; assetCode?: string; action?: string }): { items: ChangeLogRow[]; total: number } {
    const conditions: string[] = []; const values: unknown[] = [];
    if (params.assetCode) { conditions.push('asset_code = ?'); values.push(params.assetCode); }
    if (params.action) { conditions.push('action = ?'); values.push(params.action); }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRow = this.db.get(`SELECT COUNT(*) as count FROM change_logs ${whereClause}`, values);
    const total = (countRow?.count as number) || 0;
    const offset = (params.page - 1) * params.pageSize;
    const items = this.db.all(`SELECT * FROM change_logs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...values, params.pageSize, offset]);
    return { items: items.map((item) => toCamelCase(item) as ChangeLogRow), total };
  }
}
