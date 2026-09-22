import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { Database } from '../database/index.js';
import { DashboardService } from '../services/dashboard.service.js';
import { MailService } from '../services/mail.service.js';
import { AuditLogService } from '../services/audit-log.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';
import { success, error } from '../utils/response.js';

function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  const name = email.slice(0, at);
  return `${name.slice(0, 2)}***${email.slice(at)}`;
}

function buildReminderHtml(userName: string, assets: { assetCode: string; name: string; type: string }[]): string {
  const rows = assets
    .map((a) => `<tr><td style="padding:6px 12px;border:1px solid #ddd;">${a.assetCode}</td><td style="padding:6px 12px;border:1px solid #ddd;">${a.name}</td><td style="padding:6px 12px;border:1px solid #ddd;">${a.type}</td></tr>`)
    .join('');
  return `
  <div style="font-family:'Microsoft YaHei',Arial,sans-serif;max-width:640px;">
    <p>您好，<b>${userName}</b>：</p>
    <p>经资产管理系统盘点，您名下登记的设备数量已达 <b style="color:#d93025;">${assets.length}</b> 件，为规范设备管理，请您核对以下设备，如存在不再使用的设备请联系资产管理员办理归还或转移手续。</p>
    <table style="border-collapse:collapse;font-size:14px;">
      <thead><tr style="background:#f5f5f5;"><th style="padding:6px 12px;border:1px solid #ddd;">资产编号</th><th style="padding:6px 12px;border:1px solid #ddd;">资产名称</th><th style="padding:6px 12px;border:1px solid #ddd;">设备类型</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="color:#888;font-size:12px;">此邮件由资产管理系统自动发送，请勿直接回复。</p>
  </div>`;
}

export function createDashboardRouter(db: Database): Router {
  const router = Router();
  const dashboardService = new DashboardService(db);
  const mailService = new MailService(db);
  const auditLogService = new AuditLogService(db);

  router.use(authMiddleware);

  /** GET /api/dashboard/stats - 看板统计 */
  router.get('/stats', (_req: Request, res: Response) => {
    const stats = dashboardService.getStats();
    res.json(success(stats));
  });

  /** GET /api/dashboard/user-ranking - 使用人设备数量排行榜（支持使用人筛选，附带邮箱匹配信息，前端分页展示） */
  router.get('/user-ranking', (req: Request, res: Response) => {
    const keyword = String(req.query.keyword || '');
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '1000'), 10) || 1000, 1), 5000);
    const isPrivileged = ['super_admin', 'admin'].includes(req.user?.role || '');
    const rows = dashboardService.getUserRanking(keyword, limit);
    const data = rows.map((r) => {
      const { user, matchedBy } = dashboardService.resolveUser(r.userName, r.ownerUsername);
      const email = user ? String(user.email || '') : '';
      return {
        userName: r.userName,
        count: r.count,
        types: r.types,
        matched: !!user,
        hasEmail: !!email,
        emailMasked: email ? maskEmail(email) : '',
        // 完整邮箱仅管理员及以上可见
        ...(isPrivileged ? { email } : {}),
      };
    });
    res.json(success(data));
  });

  /** GET /api/dashboard/reminder-preview - 发送提醒预览（收件人+设备清单+上次提醒） */
  router.get('/reminder-preview', roleMiddleware(['super_admin', 'admin']), (req: Request, res: Response) => {
    const userName = String(req.query.userName || '').trim();
    if (!userName) {
      res.status(400).json(error(40000, '缺少使用人参数'));
      return;
    }
    const assets = dashboardService.getAssetsByUser(userName);
    const ownerUsername = assets.length > 0
      ? String((db.get('SELECT MAX(NULLIF(owner_username, \'\')) AS owner FROM assets WHERE "user" = ?', [userName]) as Record<string, unknown> | undefined)?.owner || '')
      : '';
    const { user, matchedBy } = dashboardService.resolveUser(userName, ownerUsername);
    const email = user ? String(user.email || '') : '';
    res.json(success({
      userName,
      matched: !!user,
      matchedBy,
      username: user ? String(user.username) : '',
      email,
      smtpConfigured: mailService.isConfigured(),
      assets,
      lastReminder: dashboardService.getLastReminder(userName),
    }));
  });

  /** POST /api/dashboard/send-reminder - 向使用人发送设备数量提醒邮件 */
  router.post('/send-reminder', roleMiddleware(['super_admin', 'admin']), async (req: Request, res: Response) => {
    const userName = String(req.body.userName || '').trim();
    if (!userName) {
      res.status(400).json(error(40000, '缺少使用人参数'));
      return;
    }
    const assets = dashboardService.getAssetsByUser(userName);
    if (assets.length === 0) {
      res.status(400).json(error(40000, '该使用人名下没有设备'));
      return;
    }
    const ownerUsername = String((db.get('SELECT MAX(NULLIF(owner_username, \'\')) AS owner FROM assets WHERE "user" = ?', [userName]) as Record<string, unknown> | undefined)?.owner || '');
    const { user, matchedBy } = dashboardService.resolveUser(userName, ownerUsername);
    const email = user ? String(user.email || '') : '';
    if (!user || !email) {
      res.status(400).json(error(40000, '未能关联到登录用户或该用户没有邮箱，请先在用户管理中补全信息'));
      return;
    }

    const senderId = req.user?.userId || '';
    const senderName = req.user?.username || '';
    const ip = req.clientIp || req.ip || req.socket.remoteAddress || 'unknown';
    const subject = `【设备管理提醒】您名下登记的设备已达 ${assets.length} 件`;
    const html = buildReminderHtml(userName, assets);

    const mailLog = (status: string, errMsg = ''): void => {
      db.run(
        'INSERT INTO mail_logs (id, to_email, username, asset_count, subject, status, error, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [uuidv4(), email, userName, assets.length, subject, status, errMsg, dayjs().format('YYYY-MM-DD HH:mm:ss')]
      );
      db.scheduleSave();
    };

    try {
      await mailService.send(email, subject, html);
      mailLog('sent');
      auditLogService.create({ userId: senderId, username: senderName, action: '发送提醒邮件', resource: 'dashboard', detail: `向使用人 ${userName}(${email}) 发送提醒邮件，设备数：${assets.length}`, ip });
      res.json(success({ to: email, count: assets.length }, `提醒邮件已发送至 ${email}`));
    } catch (err) {
      const message = (err as Error).message || '发送失败';
      mailLog('failed', message);
      auditLogService.create({ userId: senderId, username: senderName, action: '发送提醒邮件失败', resource: 'dashboard', detail: `向使用人 ${userName}(${email}) 发送失败：${message}`, ip });
      res.status(502).json(error(50200, `发送失败：${message}`));
    }
  });

  /** POST /api/dashboard/associate - 将未关联的使用人手动关联到登录用户 */
  router.post('/associate', roleMiddleware(['super_admin', 'admin']), (req: Request, res: Response) => {
    const userName = String(req.body.userName || '').trim();
    const username = String(req.body.username || '').trim();
    if (!userName || !username) {
      res.status(400).json(error(40000, '缺少使用人或所选用户'));
      return;
    }
    const user = db.get("SELECT * FROM users WHERE username = ? AND status = 'active'", [username]) as Record<string, unknown> | undefined;
    if (!user) {
      res.status(400).json(error(40000, '所选用户不存在或未启用'));
      return;
    }

    // 1. 该使用人名下未关联的资产写入归属用户
    const countRow = db.get(
      "SELECT COUNT(*) AS c FROM assets WHERE \"user\" = ? AND (owner_username = '' OR owner_username IS NULL)",
      [userName]
    ) as Record<string, unknown>;
    const updatedAssets = (countRow?.c as number) || 0;
    if (updatedAssets > 0) {
      db.run(
        "UPDATE assets SET owner_username = ?, updated_at = ? WHERE \"user\" = ? AND (owner_username = '' OR owner_username IS NULL)",
        [username, dayjs().format('YYYY-MM-DD HH:mm:ss'), userName]
      );
    }

    // 2. 所选用户没有中文姓名时，自动把使用人名写入（后续同名登记可自动匹配）
    let cnNameSet = false;
    if (!user.cn_name) {
      db.run('UPDATE users SET cn_name = ?, updated_at = ? WHERE id = ?', [userName, dayjs().format('YYYY-MM-DD HH:mm:ss'), user.id]);
      cnNameSet = true;
    }
    db.scheduleSave();

    const senderId = req.user?.userId || '';
    const senderName = req.user?.username || '';
    const ip = req.clientIp || req.ip || req.socket.remoteAddress || 'unknown';
    auditLogService.create({
      userId: senderId, username: senderName, action: '使用人关联', resource: 'dashboard',
      detail: `使用人「${userName}」关联到用户 ${username}，更新资产 ${updatedAssets} 台${cnNameSet ? `，并写入中文姓名「${userName}」` : ''}`,
      ip,
    });

    res.json(success({ updatedAssets, cnNameSet }, `关联成功：更新 ${updatedAssets} 台设备${cnNameSet ? '，已写入中文姓名' : ''}`));
  });

  return router;
}
