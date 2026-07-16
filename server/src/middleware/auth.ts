import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { JwtPayload } from '../types/index.js';
import { error } from '../utils/response.js';

// 扩展Express Request类型以包含user和clientIp
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      clientIp?: string;
    }
  }
}

/**
 * JWT认证中间件
 * 从Authorization头提取Bearer token，验证后注入req.user
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json(error(40100, '未提供认证令牌'));
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;

    // 排除refresh token
    if (decoded.type === 'refresh') {
      res.status(401).json(error(40100, '请使用访问令牌而非刷新令牌'));
      return;
    }

    req.user = decoded;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json(error(40100, '令牌已过期'));
      return;
    }
    res.status(401).json(error(40100, '无效的认证令牌'));
  }
}
