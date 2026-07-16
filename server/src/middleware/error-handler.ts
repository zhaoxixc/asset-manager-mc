import { Request, Response, NextFunction } from 'express';
import { error } from '../utils/response.js';

/**
 * 全局错误处理中间件
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction): void {
  console.error('[Error]', err);

  // Multer错误
  if (err.name === 'MulterError') {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? '文件大小超过限制'
      : '文件上传失败';
    res.status(400).json(error(40000, message));
    return;
  }

  // JSON解析错误
  if (err.type === 'entity.parse.failed') {
    res.status(400).json(error(40000, '请求体JSON格式错误'));
    return;
  }

  // 默认服务器错误
  const statusCode = err.statusCode || 500;
  const code = err.code || 50000;
  const message = err.message || '服务器内部错误';

  res.status(statusCode).json(error(typeof code === 'number' ? code : 50000, message));
}
