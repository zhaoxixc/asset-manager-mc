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
} from '@mui/material';
import { Send as SendIcon, SmartToy as AiIcon, Person as PersonIcon } from '@mui/icons-material';
import api from '../services/api';

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

interface AiAssistantProps {
  globalSearch: string;
}

/** AI 资产助手：通过对话查询资产信息 */
const AIAssistant: React.FC<AiAssistantProps> = () => {
  const [models, setModels] = useState<AiModelOption[]>([]);
  const [modelId, setModelId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: 'assistant', content: '你好！我是 AI 资产助手，可以帮你查询资产相关信息，例如：\n· 「查一下张三名下有哪些设备」\n· 「各种状态的资产有多少」\n· 「MC-IT2604001 这个资产的信息」' },
  ]);
  const [input, setInput] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/ai/models/enabled').then((res) => {
      const list = res.data.data || [];
      setModels(list);
      if (list.length > 0) setModelId(list[0].id);
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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 190px)', minHeight: 480 }}>
      {/* 工具栏 */}
      <Card elevation={0} sx={{ border: '1px solid #e8eaed', borderRadius: 2, mb: 2 }}>
        <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5, '&:last-child': { pb: 1.5 }, gap: 1, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AiIcon color="primary" />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>AI 资产助手</Typography>
          </Box>
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
                maxRows={4}
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
