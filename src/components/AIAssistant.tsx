import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  MenuItem,
  Paper,
  CircularProgress,
  Alert,
  InputAdornment,
  IconButton,
  Tooltip,
} from '@mui/material';
import { Send as SendIcon, SmartToy as AiIcon, Person as PersonIcon, DeleteSweep as ClearIcon } from '@mui/icons-material';
import api from '../services/api';
import useAuthStore from '../store/useAuthStore';

interface AiModelOption {
  id: string;
  name: string;
  model: string;
}

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  error?: boolean;
}

const CHAT_STORAGE_KEY = 'ai-assistant-chat-v1';
const MODEL_STORAGE_KEY = 'ai-assistant-model-v1';

function loadStoredChat(): { messages: ChatMsg[]; modelId: string } {
  try {
    const messages = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || '[]');
    const modelId = localStorage.getItem(MODEL_STORAGE_KEY) || '';
    if (Array.isArray(messages) && messages.length > 0) return { messages, modelId };
  } catch { /* 忽略损坏的本地数据 */ }
  return { messages: [], modelId: '' };
}

function saveStoredChat(messages: ChatMsg[], modelId: string): void {
  try {
    // 只保留最近 50 条，避免 localStorage 膨胀
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages.slice(-50)));
    localStorage.setItem(MODEL_STORAGE_KEY, modelId);
  } catch { /* 存储满时静默忽略 */ }
}

interface AiAssistantProps {
  globalSearch: string;
}

/** AI 资产助手：通过对话查询资产信息（仅管理员及以上可用） */
const AIAssistant: React.FC<AiAssistantProps> = () => {
  const currentUser = useAuthStore((s) => s.currentUser);
  const canUse = currentUser?.role === 'super_admin' || currentUser?.role === 'admin';
  const [models, setModels] = useState<AiModelOption[]>([]);
  const stored = loadStoredChat();
  const [messages, setMessages] = useState<ChatMsg[]>(() => {
    return stored.messages.length > 0
      ? stored.messages
      : [{ role: 'assistant', content: '你好！我是 AI 资产助手，可以帮你查询资产相关信息，例如：\n· 「查一下张三名下有哪些设备」\n· 「各种状态的资产有多少」\n· 「MC-IT2604001 这个资产的信息」' }];
  });
  const [modelId, setModelId] = useState<string>(stored.modelId);
  const [input, setInput] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  // 对话与模型选择持久化（切换页面/刷新不丢失）
  useEffect(() => {
    saveStoredChat(messages, modelId);
  }, [messages, modelId]);

  useEffect(() => {
    api.get('/ai/models/enabled').then((res) => {
      const list: AiModelOption[] = res.data.data || [];
      setModels(list);
      // 优先使用持久化的选择，仅当其无效时回退到第一个可用模型
      setModelId((prev) => (prev && list.some((m) => m.id === prev) ? prev : list[0]?.id || ''));
    }).catch(() => setModels([]));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: text }, { role: 'assistant', content: '', error: false }]);
    setSending(true);
    try {
      const res = await api.post('/ai/chat', { message: text, modelId });
      const answer = res.data.data?.answer || '（空回复）';
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: 'assistant', content: answer };
        return copy;
      });
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '请求失败';
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: 'assistant', content: message, error: true };
        return copy;
      });
    } finally {
      setSending(false);
    }
  };

  if (!canUse) {
    return (
      <Alert severity="error">
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>无权使用</Typography>
        AI 助手仅对超级管理员和管理员开放，请联系管理员。
      </Alert>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 480 }}>
      {/* 工具栏 */}
      <Card elevation={0} sx={{ border: '1px solid #e8eaed', borderRadius: 2, mb: 2 }}>
        <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5, '&:last-child': { pb: 1.5 }, gap: 1, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AiIcon color="primary" />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>AI 资产助手</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TextField
              select
              size="small"
              label="使用的模型"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              disabled={models.length === 0}
              sx={{ minWidth: 220 }}
            >
              {models.map((m) => (
                <MenuItem key={m.id} value={m.id}>{m.name}（{m.model}）</MenuItem>
              ))}
            </TextField>
            <Tooltip title="清空对话记录">
              <IconButton
                onClick={() => {
                  if (messages.length <= 1 || window.confirm('确定要清空当前对话记录吗？')) {
                    const welcome: ChatMsg = { role: 'assistant', content: '你好！我是 AI 资产助手，可以帮你查询资产相关信息，例如：\n· 「查一下张三名下有哪些设备」\n· 「各种状态的资产有多少」\n· 「MC-IT2604001 这个资产的信息」' };
                    setMessages([welcome]);
                    saveStoredChat([welcome], modelId);
                  }
                }}
              >
                <ClearIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </CardContent>
      </Card>

      {models.length === 0 ? (
        <Alert severity="warning">暂无可用的 AI 模型，请联系管理员在「系统设置 → AI 模型配置」中添加</Alert>
      ) : (
        <>
          {/* 对话区域 */}
          <Card elevation={0} sx={{ border: '1px solid #e8eaed', borderRadius: 2, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <Box ref={scrollRef} sx={{ flex: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, bgcolor: '#fafbfc', borderRadius: '0 0 8px 8px' }}>
              {messages.map((msg, i) => (
                <Box key={i} sx={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <Paper
                    elevation={0}
                    sx={{
                      maxWidth: '85%',
                      px: 2, py: 1.25,
                      borderRadius: 2,
                      bgcolor: msg.error ? '#fce8e6' : msg.role === 'user' ? '#e8f0fe' : '#ffffff',
                      border: msg.error ? '1px solid #f6aea9' : '1px solid #e8eaed',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                      {msg.role === 'assistant' ? <AiIcon sx={{ fontSize: 15, color: '#1a73e8' }} /> : <PersonIcon sx={{ fontSize: 15, color: '#5f6368' }} />}
                      <Typography variant="caption" color="text.secondary">{msg.role === 'user' ? '我' : 'AI 助手'}</Typography>
                    </Box>
                    <Typography variant="body2" sx={{ color: msg.error ? '#d93025' : 'inherit' }}>{msg.content}</Typography>
                  </Paper>
                </Box>
              ))}
              {sending && messages[messages.length - 1]?.content === '' && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <Paper elevation={0} sx={{ px: 2, py: 1.5, borderRadius: 2, border: '1px solid #e8eaed', bgcolor: '#fff' }}>
                    <CircularProgress size={16} /> <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>AI 正在查询资产数据…</Typography>
                  </Paper>
                </Box>
              )}
            </Box>
          </Card>

          {/* 输入区域 */}
          <Card elevation={0} sx={{ border: '1px solid #e8eaed', borderRadius: 2, mt: 2 }}>
            <CardContent sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                maxRows={6}
                placeholder="输入问题，如：查一下张三名下的设备 / 各状态的资产有多少"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                disabled={sending}
                size="small"
                InputProps={{ endAdornment: <InputAdornment position="end"><Typography variant="caption" color="text.disabled">Enter 发送 / Shift+Enter 换行</Typography></InputAdornment> }}
              />
              <Button variant="contained" endIcon={<SendIcon />} onClick={send} disabled={!input.trim() || sending} sx={{ textTransform: 'none', height: 40, whiteSpace: 'nowrap' }}>
                发送
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );
};

export default AIAssistant;
