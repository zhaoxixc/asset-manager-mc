import express from 'express';
import cors from 'cors';
import { Database } from './database/index.js';
import { createAuthRouter } from './routes/auth.js';
import { createAssetRouter } from './routes/assets.js';
import { createDepartmentRouter } from './routes/departments.js';
import { createAssetTypeRouter } from './routes/asset-types.js';
import { createInventoryRouter } from './routes/inventory.js';
import { createChangeLogRouter } from './routes/change-logs.js';
import { createUserRouter } from './routes/users.js';
import { createDashboardRouter } from './routes/dashboard.js';
import { createBackupRouter } from './routes/backup.js';
import { createAuditLogRouter } from './routes/audit-logs.js';
import { createAssetStatusRouter } from './routes/asset-statuses.js';
import { createCodePrefixRouter } from './routes/code-prefixes.js';
import { createSystemInfoRouter } from './routes/system-info.js';
import { healthRouter } from './routes/health.js';
import { errorHandler } from './middleware/error-handler.js';
import { loginLimiter, apiLimiter } from './middleware/rate-limit.js';
import { AuditLogService } from './services/audit-log.service.js';

/**
 * 创建并配置Express应用
 * @param db 数据库实例
 * @returns 配置好的Express应用
 */
export function createApp(db: Database): express.Application {
  const app = express();

  // 基础中间件
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // 信任反向代理，以便从 X-Forwarded-For 获取真实IP
  // loopback: 信任本机回环地址的代理（开发环境 Vite proxy / 生产环境 Nginx 本地转发）
  // linklocal: 信任链路本地地址（Docker 网络等）
  app.set('trust proxy', 'loopback, linklocal');

  // 全局IP清洗中间件：将 IPv6 映射格式的 IPv4 地址转为纯 IPv4，同时处理 ::1 本地回环
  // 当 trust proxy 生效时，req.ip 已经是 X-Forwarded-For 中的真实客户端IP
  app.use((req, _res, next) => {
    let rawIp = req.ip || req.socket.remoteAddress || 'unknown';
    if (typeof rawIp === 'string') {
      if (rawIp.startsWith('::ffff:')) {
        rawIp = rawIp.substring(7);
      } else if (rawIp === '::1') {
        rawIp = '127.0.0.1';
      }
      req.clientIp = rawIp;
    }
    next();
  });

  // 限流：登录接口单独限流
  app.use('/api/auth/login', loginLimiter);

  // 限流：其他API接口
  app.use('/api', apiLimiter);

  // 健康检查（无需鉴权）
  app.use('/api', healthRouter);

  // 认证路由（内部自行处理哪些需要鉴权）
  app.use('/api/auth', createAuthRouter(db));

  // 业务路由（路由内部自行添加authMiddleware）
  app.use('/api/assets', createAssetRouter(db));
  app.use('/api/departments', createDepartmentRouter(db));
  app.use('/api/asset-types', createAssetTypeRouter(db));
  app.use('/api/asset-statuses', createAssetStatusRouter(db));
  app.use('/api/code-prefixes', createCodePrefixRouter(db));
  app.use('/api/system-info', createSystemInfoRouter(db));
  app.use('/api/inventory', createInventoryRouter(db));
  app.use('/api/change-logs', createChangeLogRouter(db));
  app.use('/api/users', createUserRouter(db));
  app.use('/api/dashboard', createDashboardRouter(db));
  app.use('/api/backup', createBackupRouter(db));
  app.use('/api/audit-logs', createAuditLogRouter(db));

  // 全局错误处理
  app.use(errorHandler);

  // 审计日志自动清理：根据系统配置决定是否启用，保留天数也从配置读取
  // 默认不自动清理，保留365天；用户可在系统设置中开启
  const auditLogService = new AuditLogService(db);
  const runCleanupIfEnabled = () => {
    const enabledRow = db.get("SELECT value FROM system_info WHERE key = 'audit_log_cleanup_enabled'");
    if (enabledRow && enabledRow.value === 'true') {
      const daysRow = db.get("SELECT value FROM system_info WHERE key = 'audit_log_retention_days'");
      const days = parseInt(String(daysRow?.value || '365'), 10) || 365;
      auditLogService.cleanOldLogs(days);
    }
  };
  // 启动时执行一次
  runCleanupIfEnabled();
  // 每天凌晨3点执行
  const scheduleDailyCleanup = () => {
    const now = new Date();
    const next3am = new Date(now);
    next3am.setHours(3, 0, 0, 0);
    if (next3am <= now) next3am.setDate(next3am.getDate() + 1);
    const msUntil3am = next3am.getTime() - now.getTime();
    setTimeout(() => {
      runCleanupIfEnabled();
      setInterval(runCleanupIfEnabled, 24 * 60 * 60 * 1000);
    }, msUntil3am);
  };
  scheduleDailyCleanup();

  return app;
}
