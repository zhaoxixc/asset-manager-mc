import { Router, Request, Response } from 'express';
import { Database } from '../database/index.js';
import { SystemInfoService } from '../services/system-info.service.js';
import { MailService } from '../services/mail.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';
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

  /** GET /api/system-info - 获取公司信息（公开，无需鉴权，仅企业名称与Logo） */
  router.get('/', (_req: Request, res: Response) => {
    res.json(success({
      company_name: systemInfoService.get('company_name') || '',
      company_logo: systemInfoService.get('company_logo') || '',
    }));
  });

  /** GET /api/system-info/config - 完整系统配置（仅超级管理员，SMTP密码不回显） */
  router.get('/config', authMiddleware, roleMiddleware(['super_admin']), (req: Request, res: Response) => {
    const info = systemInfoService.getAll() as Record<string, unknown>;
    delete info.smtp_pass;
    info.has_smtp_pass = !!systemInfoService.get('smtp_pass');
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

  /** PUT /api/system-info - 更新系统信息（仅超级管理员） */
  router.put('/', roleMiddleware(['super_admin']), (req: Request, res: Response) => {
    const { companyName, auditLogCleanupEnabled, auditLogRetentionDays, smtpEnabled, smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass, smtpFrom, smtpFromName } = req.body;
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
    // SMTP 配置（密码留空表示不修改）
    if (smtpEnabled !== undefined) systemInfoService.set('smtp_enabled', String(smtpEnabled) === 'true' ? 'true' : 'false');
    if (smtpHost !== undefined) systemInfoService.set('smtp_host', String(smtpHost).trim());
    if (smtpPort !== undefined) {
      const port = parseInt(String(smtpPort), 10);
      if (isNaN(port) || port < 1 || port > 65535) {
        res.status(400).json(error(40000, 'SMTP端口不合法'));
        return;
      }
      systemInfoService.set('smtp_port', String(port));
    }
    if (smtpSecure !== undefined) systemInfoService.set('smtp_secure', String(smtpSecure) === 'true' ? 'true' : 'false');
    if (smtpUser !== undefined) systemInfoService.set('smtp_user', String(smtpUser).trim());
    if (smtpPass !== undefined && String(smtpPass) !== '') systemInfoService.set('smtp_pass', String(smtpPass));
    if (smtpFrom !== undefined) systemInfoService.set('smtp_from', String(smtpFrom).trim());
    if (smtpFromName !== undefined) systemInfoService.set('smtp_from_name', String(smtpFromName).trim());
    const info = systemInfoService.getAll() as Record<string, unknown>;
    delete info.smtp_pass;
    info.has_smtp_pass = !!systemInfoService.get('smtp_pass');
    res.json(success(info, '更新成功'));
  });

  /** POST /api/system-info/test-mail - 发送测试邮件（仅超级管理员） */
  router.post('/test-mail', roleMiddleware(['super_admin']), async (req: Request, res: Response) => {
    const to = String(req.body.to || '').trim();
    if (!to) {
      res.status(400).json(error(40000, '请填写测试收件邮箱'));
      return;
    }
    const mailService = new MailService(db);
    if (!mailService.isConfigured()) {
      res.status(400).json(error(40000, 'SMTP未配置或未启用，请先填写并保存邮件服务器配置'));
      return;
    }
    try {
      await mailService.send(to, '【资产管理系统】测试邮件', '<p>这是一封测试邮件，收到即表示SMTP配置正确。</p>');
      res.json(success(null, '测试邮件发送成功'));
    } catch (err) {
      res.status(502).json(error(50200, `发送失败：${(err as Error).message}`));
    }
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