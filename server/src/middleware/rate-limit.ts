import rateLimit from 'express-rate-limit';

/** 登录接口限流：10次/分钟（高于应用层5次锁定阈值，避免冲突） */
export const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 10,
  message: {
    code: 42900,
    message: '登录请求过于频繁，请1分钟后重试',
    data: null,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.clientIp || req.ip || 'unknown';
  },
});

/** API接口限流：100次/分钟 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 100,
  message: {
    code: 42900,
    message: '请求过于频繁，请稍后再试',
    data: null,
  },
  standardHeaders: true,
  legacyHeaders: false,
});
