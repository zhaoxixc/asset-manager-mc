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
    const statusDefs = this.db.all('SELECT name, color FROM asset_statuses ORDER BY created_at ASC');
    const statusColorMap = new Map(statusDefs.map((s) => [s.name as string, s.color as string]));

    const allStatusCounts = statusCounts.map((s) => ({
      name: s.status as string,
      count: s.count as number,
      color: statusColorMap.get(s.status as string) || '#757575',
    }));

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
}
