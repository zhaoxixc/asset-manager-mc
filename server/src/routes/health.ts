import { Router, Request, Response } from 'express';
import { success } from '../utils/response.js';

export const healthRouter = Router();

/** GET /api/health - 健康检查（无需鉴权） */
healthRouter.get('/health', (_req: Request, res: Response) => {
  res.json(success({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  }));
});
