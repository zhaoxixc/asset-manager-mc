import { Request, Response, NextFunction } from 'express';
import { error } from '../utils/response.js';

/**
 * 角色权限中间件
 * @param roles 允许访问的角色列表
 */
export function roleMiddleware(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json(error(40100, '未认证'));
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json(error(40300, '权限不足'));
      return;
    }

    next();
  };
}
