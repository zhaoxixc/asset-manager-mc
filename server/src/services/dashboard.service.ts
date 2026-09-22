import { Database } from '../database/index.js';

export class DashboardService {
  private db: Database;
  constructor(db: Database) { this.db = db; }

  getStats(): {
    totalAssets: number; inUseCount: number; idleCount: number; repairCount: number; scrappedCount: number; damagedCount: number;
    typeDistribution: { name: string; value: number }[];
    departmentDistribution: { name: string; count: number }[];
    recentChangeLogs: { id: string; assetCode: string; assetName: string; action: string; detail: string; createdAt: string }[];
    statusCounts: { name: string; count: number; color: string }[];
  } {
    const statusCounts = this.db.all('SELECT status, COUNT(*) as count FROM assets GROUP BY status');
    const statusMap = new Map(statusCounts.map((s) => [s.status as string, s.count as number]));

    const typeRows = this.db.all('SELECT type, COUNT(*) as count FROM assets GROUP BY type');
    const deptRows = this.db.all('SELECT department, COUNT(*) as count FROM assets GROUP BY department');
    const recentLogs = this.db.all('SELECT * FROM change_logs ORDER BY created_at DESC LIMIT 10');

    // 获取自定义状态的颜色映射
    const statusDefs = this.db.all('SELECT name, color FROM asset_statuses ORDER BY sort_order, created_at ASC');
    const statusColorMap = new Map(statusDefs.map((s) => [s.name as string, s.color as string]));

    // 状态卡片统计：以状态管理中定义的全部状态为准（含数量为0的），未定义但被资产使用的孤儿状态以灰色兜底
    const allStatusCounts = statusDefs.map((s) => ({
      name: s.name as string,
      count: statusMap.get(s.name as string) || 0,
      color: s.color as string,
    }));
    for (const s of statusCounts) {
      if (!allStatusCounts.find((x) => x.name === s.status)) {
        allStatusCounts.push({ name: s.status as string, count: s.count as number, color: '#757575' });
      }
    }

    return {
      totalAssets: statusCounts.reduce((sum, s) => sum + (s.count as number), 0),
      inUseCount: statusMap.get('在用') || 0, idleCount: statusMap.get('闲置') || 0,
      repairCount: statusMap.get('维修') || 0, scrappedCount: statusMap.get('报废') || 0,
      damagedCount: statusMap.get('损坏') || 0,
      typeDistribution: typeRows.map((r) => ({ name: r.type as string, value: r.count as number })),
      departmentDistribution: deptRows.map((r) => ({ name: (r.department as string) || '未分配', count: r.count as number })),
      recentChangeLogs: recentLogs.map((log) => ({
        id: log.id as string, assetCode: log.asset_code as string, assetName: log.asset_name as string,
        action: log.action as string, detail: log.detail as string, createdAt: log.created_at as string,
      })),
      statusCounts: allStatusCounts,
    };
  }

  /** 使用人设备数量排行（仅按资产"使用人"字段聚合，与登录用户无关，支持使用人模糊过滤；名字按首尾去空白归一） */
  getUserRanking(keyword: string, limit: number): { userName: string; count: number; types: string[]; ownerUsername: string }[] {
    const kw = `%${keyword.trim()}%`;
    const rows = this.db.all(
      `SELECT TRIM("user") AS user, COUNT(*) AS count, GROUP_CONCAT(DISTINCT type) AS types, MAX(NULLIF(owner_username, '')) AS owner_username
       FROM assets
       WHERE TRIM("user") != '' AND "user" LIKE ?
       GROUP BY TRIM("user")
       ORDER BY count DESC
       LIMIT ?`,
      [kw, limit]
    );
    return rows.map((r) => ({
      userName: (r.user as string).trim(),
      count: r.count as number,
      types: ((r.types as string) || '').split(',').filter(Boolean),
      ownerUsername: (r.owner_username as string) || '',
    }));
  }

  /**
   * 将使用人名解析为登录用户
   * 优先级：资产owner_username精确关联 → 用户cn_name → 用户real_name → 用户username
   */
  resolveUser(userName: string, ownerUsername?: string): { user: Record<string, unknown> | null; matchedBy: string } {
    const find = (sql: string, val: string) =>
      this.db.get(sql, [val]) as Record<string, unknown> | undefined;
    const base = "SELECT * FROM users WHERE status = 'active'";
    if (ownerUsername) {
      const byOwner = find(`${base} AND username = ?`, ownerUsername);
      if (byOwner) return { user: byOwner, matchedBy: 'owner_username' };
    }
    const byCn = find(`${base} AND cn_name != '' AND cn_name = ?`, userName);
    if (byCn) return { user: byCn, matchedBy: 'cn_name' };
    const byReal = find(`${base} AND real_name = ?`, userName);
    if (byReal) return { user: byReal, matchedBy: 'real_name' };
    const byUsername = find(`${base} AND username = ?`, userName);
    if (byUsername) return { user: byUsername, matchedBy: 'username' };
    return { user: null, matchedBy: '' };
  }

  /** 使用人名下全部设备（与排行榜口径一致：使用人按去空白后精确匹配） */
  getAssetsByUser(userName: string): { assetCode: string; name: string; type: string }[] {
    const rows = this.db.all(
      'SELECT asset_code, name, type FROM assets WHERE TRIM("user") = ? ORDER BY asset_code ASC',
      [userName.trim()]
    );
    return rows.map((r) => ({ assetCode: r.asset_code as string, name: r.name as string, type: r.type as string }));
  }

  /** 最近一次提醒记录 */
  getLastReminder(userName: string): { time: string; assetCount: number } | null {
    const row = this.db.get(
      "SELECT created_at, asset_count FROM mail_logs WHERE username = ? AND status = 'sent' ORDER BY created_at DESC LIMIT 1",
      [userName]
    );
    if (!row) return null;
    return { time: row.created_at as string, assetCount: row.asset_count as number };
  }
}
