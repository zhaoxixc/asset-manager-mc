import { Router, Request, Response } from 'express';
import { Database } from '../database/index.js';
import { BackupService } from '../services/backup.service.js';
import { AuditLogService } from '../services/audit-log.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';
import { success, error } from '../utils/response.js';
import multer from 'multer';
import { tmpdir } from 'os';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

// Multer配置：临时文件上传
const upload = multer({
  dest: join(tmpdir(), 'asset-manager-backup'),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

export function createBackupRouter(db: Database): Router {
  const router = Router();
  const auditLogService = new AuditLogService(db);
  const backupService = new BackupService(db, auditLogService);

  router.use(authMiddleware);
  router.use(roleMiddleware(['super_admin']));

  /** GET /api/backup - 导出备份 */
  router.get('/', (req: Request, res: Response) => {
    const userId = req.user?.userId || '';
    const username = req.user?.username || '';
    const ip = req.clientIp || req.ip || req.socket.remoteAddress || 'unknown';

    try {
      const buffer = backupService.exportBackup(userId, username, ip);
      const filename = `asset-manager-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.db`;

      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err) {
      res.status(500).json(error(50000, `备份导出失败：${(err as Error).message}`));
    }
  });

  /** POST /api/backup/restore - 恢复备份 */
  router.post('/restore', upload.single('file'), async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json(error(40000, '请上传备份文件'));
      return;
    }

    const userId = req.user?.userId || '';
    const username = req.user?.username || '';
    const ip = req.clientIp || req.ip || req.socket.remoteAddress || 'unknown';

    const result = await backupService.restoreBackup(req.file.path, userId, username, ip);

    if (!result.success) {
      res.status(400).json(error(40000, result.message));
      return;
    }

    res.json(success(null, result.message));
  });

  return router;
}
