import { Router, Request, Response } from 'express';
import { Database } from '../database/index.js';
import { InventoryService } from '../services/inventory.service.js';
import { AuditLogService } from '../services/audit-log.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { success, error } from '../utils/response.js';

export function createInventoryRouter(db: Database): Router {
  const router = Router();
  const auditLogService = new AuditLogService(db);
  const inventoryService = new InventoryService(db, auditLogService);

  router.use(authMiddleware);

  /** GET /api/inventory/tasks - 盘点任务列表 */
  router.get('/tasks', (_req: Request, res: Response) => {
    const tasks = inventoryService.listTasks();
    res.json(success(tasks));
  });

  /** POST /api/inventory/tasks - 创建盘点任务 */
  router.post('/tasks', (req: Request, res: Response) => {
    const { name, department } = req.body;
    if (!name?.trim()) {
      res.status(400).json(error(40000, '任务名称不能为空'));
      return;
    }

    const userId = req.user?.userId || '';
    const username = req.user?.username || '';
    const ip = req.clientIp || req.ip || req.socket.remoteAddress || 'unknown';

    const task = inventoryService.createTask({
      name: name.trim(),
      department: department || '',
      userId,
      username,
      ip,
    });

    res.status(201).json(success(task, '创建成功'));
  });

  /** PUT /api/inventory/tasks/:taskId/records/:recordId - 更新盘点记录 */
  router.put('/tasks/:taskId/records/:recordId', (req: Request, res: Response) => {
    const { status, remark } = req.body;
    if (!status) {
      res.status(400).json(error(40000, '盘点状态不能为空'));
      return;
    }

    const userId = req.user?.userId || '';
    const username = req.user?.username || '';
    const ip = req.clientIp || req.ip || req.socket.remoteAddress || 'unknown';

    const result = inventoryService.updateRecord({
      taskId: String(req.params.taskId),
      recordId: String(req.params.recordId),
      status,
      remark: remark || '',
      userId,
      username,
      ip,
    });

    if (!result) {
      res.status(404).json(error(40400, '盘点记录不存在'));
      return;
    }

    res.json(success(result, '更新成功'));
  });

  /** DELETE /api/inventory/tasks/:taskId - 删除盘点任务 */
  router.delete('/tasks/:taskId', (req: Request, res: Response) => {
    const userId = req.user?.userId || '';
    const username = req.user?.username || '';
    const ip = req.clientIp || req.ip || req.socket.remoteAddress || 'unknown';

    const deleted = inventoryService.deleteTask(String(req.params.taskId), userId, username, ip);
    if (!deleted) {
      res.status(404).json(error(40400, '盘点任务不存在'));
      return;
    }
    res.json(success(null, '删除成功'));
  });

  return router;
}
