import { Database } from '../database/index.js';
import { AuditLogService } from './audit-log.service.js';
import { readFileSync, unlinkSync } from 'fs';

export class BackupService {
  private db: Database;
  private auditLogService: AuditLogService;
  constructor(db: Database, auditLogService: AuditLogService) { this.db = db; this.auditLogService = auditLogService; }

  /** 导出数据库备份 */
  exportBackup(userId: string, username: string, ip: string): Buffer {
    // 先保存当前内存状态到磁盘
    this.db.saveToFile();
    // 从内存数据库导出
    const data = this.db.getDb().export();
    const buffer = Buffer.from(data);
    this.auditLogService.create({ userId, username, action: '导出备份', resource: 'backup', detail: '导出数据库备份', ip });
    return buffer;
  }

  /** 从备份文件恢复数据库 */
  async restoreBackup(tempFilePath: string, userId: string, username: string, ip: string): Promise<{ success: boolean; message: string }> {
    try {
      // 1. 读取备份文件
      const backupBuffer = readFileSync(tempFilePath);

      // 2. 验证备份文件是否为有效的SQLite数据库
      const SQL = await (await import('sql.js')).default();
      let testDb: InstanceType<typeof SQL.Database> | null = null;
      try {
        testDb = new SQL.Database(backupBuffer);
        const tables = testDb.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='users'");
        if (!tables.length) {
          testDb.close();
          return { success: false, message: '备份文件无效：缺少必要的数据表' };
        }
        testDb.close();
      } catch {
        if (testDb) testDb.close();
        return { success: false, message: '备份文件不是有效的数据库文件' };
      }

      // 3. 先保存当前数据库状态（安全备份）
      this.db.saveToFile();

      // 4. 使用 reinitializeFromBuffer 从备份数据恢复
      await this.db.reinitializeFromBuffer(backupBuffer);

      // 5. 记录审计日志
      this.auditLogService.create({ userId, username, action: '恢复备份', resource: 'backup', detail: '从备份文件恢复数据库', ip });

      // 6. 清理临时文件
      try { unlinkSync(tempFilePath); } catch { /* 忽略清理失败 */ }

      return { success: true, message: '数据恢复成功' };
    } catch (err) {
      // 清理临时文件
      try { unlinkSync(tempFilePath); } catch { /* 忽略 */ }
      return { success: false, message: `恢复失败：${(err as Error).message}` };
    }
  }
}
