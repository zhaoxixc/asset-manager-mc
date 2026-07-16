import { Router, Request, Response } from 'express';
import { Database } from '../database/index.js';
import { SystemInfoService } from '../services/system-info.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { success, error } from '../utils/response.js';
import multer from 'multer';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const uploadDir = join(__dirname, '../../data/uploads');
      if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const ext = file.originalname.split('.').pop() || 'png';
      cb(null, `company-logo.${ext}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('只支持 PNG/JPEG/GIF/WebP 格式的图片'));
    }
  },
});

export function createSystemInfoRouter(db: Database): Router {
  const router = Router();
  const systemInfoService = new SystemInfoService(db);

  /** GET /api/system-info - 获取系统信息（公开，无需鉴权） */
  router.get('/', (_req: Request, res: Response) => {
    const info = systemInfoService.getAll();
    res.json(success(info));
  });

  /** GET /api/system-info/logo-file - 获取企业Logo文件（公开，无需鉴权） */
  router.get('/logo-file', (_req: Request, res: Response) => {
    const ext = systemInfoService.get('company_logo_ext') || 'png';
    const uploadDir = join(__dirname, '../../data/uploads');
    const filePath = join(uploadDir, `company-logo.${ext}`);
    if (!existsSync(filePath)) {
      res.status(404).send('Not found');
      return;
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    res.sendFile(filePath);
  });

  // 以下路由需要认证
  router.use(authMiddleware);

  /** PUT /api/system-info - 更新系统信息 */
  router.put('/', (req: Request, res: Response) => {
    const { companyName, auditLogCleanupEnabled, auditLogRetentionDays } = req.body;
    if (companyName !== undefined) {
      systemInfoService.set('company_name', String(companyName));
    }
    if (auditLogCleanupEnabled !== undefined) {
      systemInfoService.set('audit_log_cleanup_enabled', String(auditLogCleanupEnabled));
    }
    if (auditLogRetentionDays !== undefined) {
      const days = parseInt(String(auditLogRetentionDays), 10);
      if (isNaN(days) || days < 30 || days > 3650) {
        res.status(400).json(error(40000, '保留天数必须在30-3650之间'));
        return;
      }
      systemInfoService.set('audit_log_retention_days', String(days));
    }
    const info = systemInfoService.getAll();
    res.json(success(info, '更新成功'));
  });

  /** POST /api/system-info/logo - 上传企业Logo */
  router.post('/logo', upload.single('logo'), (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json(error(40000, '请选择图片文件'));
      return;
    }
    const ext = req.file.originalname.split('.').pop() || 'png';
    const logoUrl = `/api/system-info/logo-file`;
    systemInfoService.set('company_logo', logoUrl);
    systemInfoService.set('company_logo_ext', ext);
    res.json(success({ url: logoUrl }, 'Logo上传成功'));
  });

  return router;
}