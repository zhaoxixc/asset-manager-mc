import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { Database } from '../database/index.js';
import { AiService, AiModelConfig } from '../services/ai.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';
import { success, error } from '../utils/response.js';

export function createAiRouter(db: Database): Router {
  const router = Router();
  const aiService = new AiService(db);

  router.use(authMiddleware);

  /** GET /api/ai/models/enabled - 已启用的模型列表（仅管理员及以上，用于对话时选择） */
  router.get('/models/enabled', roleMiddleware(['super_admin', 'admin']), (_req: Request, res: Response) => {
    const rows = db.all('SELECT id, name, model FROM ai_models WHERE enabled = 1 ORDER BY created_at ASC');
    res.json(success(rows));
  });

  // 以下模型配置管理仅超级管理员
  router.use('/models', roleMiddleware(['super_admin']));

  /** GET /api/ai/models - 模型配置列表（API Key 不回显） */
  router.get('/models', (_req: Request, res: Response) => {
    const rows = db.all('SELECT * FROM ai_models ORDER BY created_at ASC');
    const list = rows.map((r) => {
      const key = String(r.api_key || '');
      return {
        id: r.id, name: r.name, baseUrl: r.base_url, model: r.model,
        apiFormat: r.api_format === 'anthropic' ? 'anthropic' : 'openai',
        enabled: !!r.enabled, hasApiKey: !!key,
        apiKeyMasked: key ? `${key.slice(0, 4)}****${key.slice(-4)}` : '',
      };
    });
    res.json(success(list));
  });

  /** POST /api/ai/models - 新增模型配置 */
  router.post('/models', (req: Request, res: Response) => {
    const { name, baseUrl, apiKey, model, enabled, apiFormat } = req.body;
    if (!name?.trim() || !baseUrl?.trim() || !model?.trim()) {
      res.status(400).json(error(40000, '名称、接口地址、模型名称不能为空'));
      return;
    }
    if (!apiKey?.trim()) {
      res.status(400).json(error(40000, 'API Key 不能为空'));
      return;
    }
    const fmt = apiFormat === 'anthropic' ? 'anthropic' : 'openai';
    const id = uuidv4();
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    db.run(
      'INSERT INTO ai_models (id, name, base_url, api_key, model, api_format, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, name.trim(), baseUrl.trim(), apiKey.trim(), model.trim(), fmt, enabled === false ? 0 : 1, now, now]
    );
    db.scheduleSave();
    res.status(201).json(success({ id }, '新增成功'));
  });

  /** PUT /api/ai/models/:id - 更新模型配置（apiKey 留空表示不修改） */
  router.put('/models/:id', (req: Request, res: Response) => {
    const existing = db.get('SELECT * FROM ai_models WHERE id = ?', [req.params.id]) as Record<string, unknown> | undefined;
    if (!existing) {
      res.status(404).json(error(40400, '模型配置不存在'));
      return;
    }
    const { name, baseUrl, apiKey, model, enabled, apiFormat } = req.body;
    if (!name?.trim() || !baseUrl?.trim() || !model?.trim()) {
      res.status(400).json(error(40000, '名称、接口地址、模型名称不能为空'));
      return;
    }
    const newKey = apiKey?.trim() ? String(apiKey).trim() : String(existing.api_key || '');
    const fmt = apiFormat === 'anthropic' ? 'anthropic' : 'openai';
    db.run(
      'UPDATE ai_models SET name = ?, base_url = ?, api_key = ?, model = ?, api_format = ?, enabled = ?, updated_at = ? WHERE id = ?',
      [name.trim(), baseUrl.trim(), newKey, model.trim(), fmt, enabled === false ? 0 : 1, dayjs().format('YYYY-MM-DD HH:mm:ss'), req.params.id]
    );
    db.scheduleSave();
    res.json(success(null, '更新成功'));
  });

  /** DELETE /api/ai/models/:id - 删除模型配置 */
  router.delete('/models/:id', (req: Request, res: Response) => {
    const existing = db.get('SELECT id FROM ai_models WHERE id = ?', [req.params.id]);
    if (!existing) {
      res.status(404).json(error(40400, '模型配置不存在'));
      return;
    }
    db.run('DELETE FROM ai_models WHERE id = ?', [req.params.id]);
    db.scheduleSave();
    res.json(success(null, '删除成功'));
  });

  /** POST /api/ai/models/:id/test - 测试已保存的模型配置连通性 */
  router.post('/models/:id/test', async (req: Request, res: Response) => {
    const cfgRow = db.get('SELECT * FROM ai_models WHERE id = ?', [req.params.id]) as Record<string, unknown> | undefined;
    if (!cfgRow) {
      res.status(404).json(error(40400, '模型配置不存在'));
      return;
    }
    const cfg: AiModelConfig = {
      baseUrl: String(cfgRow.base_url), apiKey: String(cfgRow.api_key || ''), model: String(cfgRow.model),
      apiFormat: cfgRow.api_format === 'anthropic' ? 'anthropic' : 'openai',
    };
    if (!cfg.apiKey) {
      res.status(400).json(error(40000, '该配置缺少 API Key'));
      return;
    }
    const result = await aiService.test(cfg);
    res.json(success(result, result.ok ? `连接成功（${result.latencyMs}ms）` : undefined));
  });

  /** POST /api/ai/chat - AI 对话（仅管理员及以上） */
  router.post('/chat', roleMiddleware(['super_admin', 'admin']), async (req: Request, res: Response) => {
    const message = String(req.body.message || '').trim();
    const modelId = String(req.body.modelId || '');
    if (!message) {
      res.status(400).json(error(40000, '问题内容不能为空'));
      return;
    }
    const cfgRow = modelId
      ? db.get('SELECT * FROM ai_models WHERE id = ? AND enabled = 1', [modelId]) as Record<string, unknown> | undefined
      : db.get('SELECT * FROM ai_models WHERE enabled = 1 ORDER BY created_at ASC LIMIT 1') as Record<string, unknown> | undefined;
    if (!cfgRow) {
      res.status(400).json(error(40000, '没有可用的 AI 模型，请联系管理员在系统设置中配置'));
      return;
    }
    const cfg: AiModelConfig = { baseUrl: String(cfgRow.base_url), apiKey: String(cfgRow.api_key || ''), model: String(cfgRow.model), apiFormat: cfgRow.api_format === 'anthropic' ? 'anthropic' : 'openai' };
    const modelName = String(cfgRow.name);
    const userId = req.user?.userId || '';
    const username = req.user?.username || '';
    const ip = req.clientIp || req.ip || req.socket.remoteAddress || 'unknown';

    const logChat = (answer: string, status: string, errMsg = ''): void => {
      db.run(
        'INSERT INTO ai_chat_logs (id, user_id, username, question, answer, model, status, error, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [uuidv4(), userId, username, message, answer.slice(0, 4000), modelName, status, errMsg.slice(0, 500), dayjs().format('YYYY-MM-DD HH:mm:ss')]
      );
      db.scheduleSave();
    };

    try {
      const answer = await aiService.chat(message, cfg);
      logChat(answer, 'sent');
      res.json(success({ answer, model: modelName }));
    } catch (err) {
      const msg = (err as Error).message || '请求失败';
      logChat(`ERROR: ${msg}`, 'failed', msg);
      res.status(502).json(error(50200, `AI 请求失败：${msg}`));
    }
  });

  return router;
}
