import { Database } from '../database/index.js';

/** OpenAI 兼容接口配置（DeepSeek/GLM/Ollama等）或 Anthropic 接口（Kimi Code/Claude） */
export interface AiModelConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  /** 接口协议：openai（默认）或 anthropic */
  apiFormat?: 'openai' | 'anthropic';
}

interface ToolCall {
  id: string;
  type: string;
  function: { name: string; arguments: string };
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

const SYSTEM_PROMPT = `你是企业设备资产管理系统的智能助手。通过调用工具查询系统中的真实资产数据后回答用户问题。

可用工具：
1. get_asset_statistics — 资产整体统计：总数、按状态/部门/类型的数量分布、未填写使用人的设备数
2. search_assets — 按条件搜索资产明细，支持关键词（资产编号/名称/使用人/MAC/主机名/备注模糊匹配）以及使用人、状态、部门、类型精确筛选

规则：
- 涉及具体资产、某个人的设备、数量统计时，必须先调用工具查询真实数据，禁止凭空编造
- 搜索某个使用人的设备时优先使用 user 参数（使用人姓名精确匹配）
- 回答使用中文，简洁准确；涉及多条资产时用列表逐条呈现（含资产编号）
- 最多连续调用工具 3 轮，之后基于已获得的数据直接回答`;

/** AI 对话服务：对接 OpenAI 兼容接口（/chat/completions），通过工具调用查询资产数据 */
export class AiService {
  private db: Database;

  constructor(db: Database) { this.db = db; }

  private tools = [
    {
      type: 'function',
      function: {
        name: 'get_asset_statistics',
        description: '获取资产整体统计：总数、按状态/部门/类型的数量分布、未填写使用人的设备数',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'search_assets',
        description: '按条件搜索资产明细列表（最多返回50条及匹配总数）',
        parameters: {
          type: 'object',
          properties: {
            keyword: { type: 'string', description: '关键词：资产编号/名称/使用人/MAC/主机名/备注 模糊匹配' },
            user: { type: 'string', description: '使用人姓名（精确匹配）' },
            status: { type: 'string', description: '资产状态（精确匹配）' },
            department: { type: 'string', description: '使用部门（精确匹配）' },
            type: { type: 'string', description: '资产类型（精确匹配）' },
          },
          required: [],
        },
      },
    },
  ];

  /** 单次对话补全请求（OpenAI 格式） */
  private async completionOpenAI(cfg: AiModelConfig, messages: ChatMessage[], withTools: boolean): Promise<ChatMessage> {
    const url = cfg.baseUrl.replace(/\/+$/, '') + '/chat/completions';
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 60000);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
        body: JSON.stringify({
          model: cfg.model,
          messages,
          temperature: 0.2,
          ...(withTools ? { tools: this.tools, tool_choice: 'auto' } : {}),
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const text = (await res.text()).slice(0, 300);
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      const data = await res.json();
      return data.choices?.[0]?.message || {};
    } finally {
      clearTimeout(timer);
    }
  }

  /** Anthropic Messages API（/v1/messages，x-api-key 头，content 为 block 数组） */
  private async completionAnthropic(cfg: AiModelConfig, messages: unknown[], withTools: boolean): Promise<{ content: { type: string; text?: string; id?: string; name?: string; input?: Record<string, string> }[]; stop_reason: string }> {
    const url = cfg.baseUrl.replace(/\/+$/, '') + '/v1/messages';
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 60000);
    const anthropicTools = this.tools.map((t) => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters,
    }));
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: cfg.model,
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages,
          temperature: 0.2,
          ...(withTools ? { tools: anthropicTools } : {}),
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const text = (await res.text()).slice(0, 300);
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  /** 执行工具查询（真实数据） */
  private runTool(name: string, args: Record<string, string>): unknown {
    if (name === 'get_asset_statistics') {
      const total = (this.db.get('SELECT COUNT(*) AS c FROM assets')?.c as number) || 0;
      const byStatus = this.db.all('SELECT status AS name, COUNT(*) AS count FROM assets GROUP BY status ORDER BY count DESC');
      const byDept = this.db.all('SELECT department AS name, COUNT(*) AS count FROM assets GROUP BY department ORDER BY count DESC');
      const byType = this.db.all('SELECT type AS name, COUNT(*) AS count FROM assets GROUP BY type ORDER BY count DESC');
      const noUser = (this.db.get("SELECT COUNT(*) AS c FROM assets WHERE TRIM(\"user\") = ''")?.c as number) || 0;
      return { total, byStatus, byDepartment: byDept, byType, unassignedCount: noUser };
    }
    if (name === 'search_assets') {
      const conditions: string[] = [];
      const values: unknown[] = [];
      if (args.keyword) { conditions.push('(name LIKE ? OR asset_code LIKE ? OR "user" LIKE ? OR remark LIKE ? OR wired_macs LIKE ? OR wireless_macs LIKE ? OR hostnames LIKE ?)'); const kw = `%${args.keyword}%`; values.push(kw, kw, kw, kw, kw, kw, kw); }
      if (args.user) { conditions.push('TRIM("user") = ?'); values.push(args.user.trim()); }
      if (args.status) { conditions.push('status = ?'); values.push(args.status); }
      if (args.department) { conditions.push('department = ?'); values.push(args.department); }
      if (args.type) { conditions.push('type = ?'); values.push(args.type); }
      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const total = (this.db.get(`SELECT COUNT(*) AS c FROM assets ${where}`, values)?.c as number) || 0;
      const rows = this.db.all(
        `SELECT asset_code, name, type, department, "user", status, location FROM assets ${where} ORDER BY asset_code LIMIT 50`,
        values
      );
      return {
        total,
        returned: rows.length,
        truncated: total > rows.length,
        assets: rows.map((r) => ({ 资产编号: r.asset_code, 名称: r.name, 类型: r.type, 部门: r.department, 使用人: r.user, 状态: r.status, 位置: r.location })),
      };
    }
    return { error: `未知工具: ${name}` };
  }

  /** 对话主流程：按协议格式分发（OpenAI 或 Anthropic），带工具调用循环（最多3轮） */
  async chat(question: string, cfg: AiModelConfig): Promise<string> {
    if (cfg.apiFormat === 'anthropic') {
      return this.chatAnthropic(question, cfg);
    }
    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: question },
    ];
    for (let round = 0; round < 3; round++) {
      const msg = await this.completionOpenAI(cfg, messages, true);
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        messages.push(msg);
        for (const tc of msg.tool_calls) {
          let args: Record<string, string> = {};
          try { args = JSON.parse(tc.function?.arguments || '{}'); } catch { /* 忽略参数解析错误 */ }
          const result = this.runTool(tc.function?.name || '', args);
          messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result).slice(0, 20000) });
        }
        continue;
      }
      return msg.content || '（模型返回了空回复）';
    }
    const final = await this.completionOpenAI(cfg, [...messages, { role: 'user', content: '请基于以上查询结果直接给出最终回答。' }], false);
    return final.content || '（模型返回了空回复）';
  }

  /** Anthropic 格式对话主流程（工具调用循环） */
  private async chatAnthropic(question: string, cfg: AiModelConfig): Promise<string> {
    const messages: { role: string; content: unknown }[] = [
      { role: 'user', content: [{ type: 'text', text: question }] },
    ];
    const textOf = (content: { type: string; text?: string }[]): string =>
      content.filter((b) => b.type === 'text').map((b) => b.text || '').join('') || '';

    for (let round = 0; round < 3; round++) {
      const res = await this.completionAnthropic(cfg, messages, true);
      const toolUses = res.content.filter((b) => b.type === 'tool_use');
      if (toolUses.length === 0) {
        return textOf(res.content) || '（模型返回了空回复）';
      }
      messages.push({ role: 'assistant', content: res.content });
      const results = toolUses.map((tu) => ({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: JSON.stringify(this.runTool(tu.name || '', tu.input || {})).slice(0, 20000),
      }));
      messages.push({ role: 'user', content: results });
    }
    messages.push({ role: 'user', content: [{ type: 'text', text: '请基于以上查询结果直接给出最终回答。' }] });
    const final = await this.completionAnthropic(cfg, messages, false);
    return textOf(final.content) || '（模型返回了空回复）';
  }

  /** 连接测试：发送短消息并限制输出长度，快速返回（支持 OpenAI / Anthropic 两种协议） */
  async test(cfg: AiModelConfig): Promise<{ ok: boolean; latencyMs: number; reply?: string; error?: string }> {
    const start = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    try {
      let res: globalThis.Response;
      if (cfg.apiFormat === 'anthropic') {
        res = await fetch(cfg.baseUrl.replace(/\/+$/, '') + '/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({
            model: cfg.model,
            max_tokens: 20,
            messages: [{ role: 'user', content: '请只回复四个字：连接成功' }],
          }),
          signal: ctrl.signal,
        });
      } else {
        res = await fetch(cfg.baseUrl.replace(/\/+$/, '') + '/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
          body: JSON.stringify({
            model: cfg.model,
            messages: [{ role: 'user', content: '请只回复四个字：连接成功' }],
            max_tokens: 20,
            temperature: 0,
          }),
          signal: ctrl.signal,
        });
      }
      clearTimeout(timer);
      if (!res.ok) {
        const text = (await res.text()).slice(0, 300);
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      const data = await res.json();
      let reply = '';
      if (cfg.apiFormat === 'anthropic') {
        reply = (data.content || []).filter((b: { type: string }) => b.type === 'text').map((b: { text?: string }) => b.text || '').join('');
      } else {
        reply = data.choices?.[0]?.message?.content || '';
      }
      return { ok: true, latencyMs: Date.now() - start, reply: reply.slice(0, 50) };
    } catch (err) {
      clearTimeout(timer);
      const msg = (err as Error).name === 'AbortError' ? '请求超时（30秒）' : (err as Error).message;
      return { ok: false, latencyMs: Date.now() - start, error: msg };
    }
  }
}
