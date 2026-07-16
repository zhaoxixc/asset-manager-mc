import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  MenuItem,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  Button,
} from '@mui/material';
import { Search as SearchIcon, Refresh as RefreshIcon, RestartAlt as ResetIcon } from '@mui/icons-material';
import api from '../services/api';
import { AuditLog } from '../types';

const actionColorMap: Record<string, { bg: string; color: string }> = {
  '登录': { bg: '#e8f0fe', color: '#1a73e8' },
  '登出': { bg: '#e8f0fe', color: '#1a73e8' },
  '新增资产': { bg: '#e6f4ea', color: '#34a853' },
  '编辑资产': { bg: '#e8f0fe', color: '#1a73e8' },
  '删除资产': { bg: '#fce8e6', color: '#ea4335' },
  '批量删除资产': { bg: '#fce8e6', color: '#ea4335' },
  '导入资产': { bg: '#e6f4ea', color: '#34a853' },
  '新增部门': { bg: '#e6f4ea', color: '#34a853' },
  '编辑部门': { bg: '#e8f0fe', color: '#1a73e8' },
  '删除部门': { bg: '#fce8e6', color: '#ea4335' },
  '新增用户': { bg: '#e6f4ea', color: '#34a853' },
  '编辑用户': { bg: '#e8f0fe', color: '#1a73e8' },
  '删除用户': { bg: '#fce8e6', color: '#ea4335' },
  '重置密码': { bg: '#fef3e2', color: '#ff6d00' },
  '修改密码': { bg: '#fef3e2', color: '#ff6d00' },
  '导出备份': { bg: '#e8f0fe', color: '#1a73e8' },
  '恢复备份': { bg: '#fef3e2', color: '#ff6d00' },
  '新增编号前缀': { bg: '#e6f4ea', color: '#34a853' },
  '编辑编号前缀': { bg: '#e8f0fe', color: '#1a73e8' },
  '删除编号前缀': { bg: '#fce8e6', color: '#ea4335' },
  '编辑系统信息': { bg: '#e8f0fe', color: '#1a73e8' },
};

interface AuditLogPageProps {
  globalSearch: string;
}

const AuditLogPage: React.FC<AuditLogPageProps> = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(20);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionFilter, setActionFilter] = useState<string>('');
  const [usernameFilter, setUsernameFilter] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [pageInput, setPageInput] = useState<string>('1');

  const totalCount = Math.ceil(total / rowsPerPage);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {
        page: page + 1,
        pageSize: rowsPerPage,
      };
      if (actionFilter) params.action = actionFilter;
      if (usernameFilter) params.username = usernameFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await api.get('/audit-logs', { params });
      setLogs(res.data.data.items);
      setTotal(res.data.data.total);
    } catch {
      // handled by global interceptor
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, actionFilter, usernameFilter, startDate, endDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    setPageInput(String(page + 1));
  }, [page]);

  const handlePageChange = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleRowsPerPageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  const handlePageJump = () => {
    const num = parseInt(pageInput, 10);
    if (!isNaN(num) && num >= 1 && num <= totalCount) {
      setPage(num - 1);
    } else {
      setPageInput(String(page + 1));
    }
  };

  const handleReset = () => {
    setActionFilter('');
    setUsernameFilter('');
    setStartDate('');
    setEndDate('');
    setPage(0);
  };

  return (
    <Box>
      <Card elevation={0} sx={{ border: '1px solid #e8eaed', borderRadius: 2, mb: 2 }}>
        <CardContent sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mr: 1 }}>
            审计日志
          </Typography>
          <TextField
            size="small"
            placeholder="搜索用户名..."
            value={usernameFilter}
            onChange={(e) => { setUsernameFilter(e.target.value); setPage(0); }}
            sx={{ width: 160 }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment>,
            }}
          />
          <TextField
            select
            size="small"
            label="操作类型"
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(0); }}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="">全部</MenuItem>
            <MenuItem value="登录">登录</MenuItem>
            <MenuItem value="登出">登出</MenuItem>
            <MenuItem value="新增资产">新增资产</MenuItem>
            <MenuItem value="编辑资产">编辑资产</MenuItem>
            <MenuItem value="删除资产">删除资产</MenuItem>
            <MenuItem value="导入资产">导入资产</MenuItem>
            <MenuItem value="新增部门">新增部门</MenuItem>
            <MenuItem value="编辑部门">编辑部门</MenuItem>
            <MenuItem value="删除部门">删除部门</MenuItem>
            <MenuItem value="新增用户">新增用户</MenuItem>
            <MenuItem value="编辑用户">编辑用户</MenuItem>
            <MenuItem value="删除用户">删除用户</MenuItem>
            <MenuItem value="重置密码">重置密码</MenuItem>
            <MenuItem value="修改密码">修改密码</MenuItem>
            <MenuItem value="导出备份">导出备份</MenuItem>
            <MenuItem value="恢复备份">恢复备份</MenuItem>
          </TextField>
          <TextField
            size="small"
            type="date"
            label="开始日期"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(0); }}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 160 }}
          />
          <TextField
            size="small"
            type="date"
            label="结束日期"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(0); }}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 160 }}
          />
          <IconButton onClick={fetchLogs} title="刷新" size="small">
            <RefreshIcon fontSize="small" />
          </IconButton>
          {(actionFilter || usernameFilter || startDate || endDate) && (
            <Button size="small" startIcon={<ResetIcon />} onClick={handleReset} sx={{ textTransform: 'none' }}>
              重置
            </Button>
          )}
        </CardContent>
      </Card>

      <Card elevation={0} sx={{ border: '1px solid #e8eaed', borderRadius: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, width: 160 }}>时间</TableCell>
                    <TableCell sx={{ fontWeight: 600, width: 100 }}>用户</TableCell>
                    <TableCell sx={{ fontWeight: 600, width: 120 }}>操作</TableCell>
                    <TableCell sx={{ fontWeight: 600, width: 80 }}>资源</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>详情</TableCell>
                    <TableCell sx={{ fontWeight: 600, width: 130 }}>IP</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logs.length > 0 ? (
                    logs.map((log) => {
                      const ac = actionColorMap[log.action] || { bg: '#f5f5f5', color: '#757575' };
                      return (
                        <TableRow key={log.id} hover>
                          <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{log.createdAt}</TableCell>
                          <TableCell>{log.username}</TableCell>
                          <TableCell>
                            <Chip
                              label={log.action}
                              size="small"
                              sx={{ bgcolor: ac.bg, color: ac.color, fontWeight: 600, fontSize: '0.75rem' }}
                            />
                          </TableCell>
                          <TableCell>{log.resource}</TableCell>
                          <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {log.detail}
                          </TableCell>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{log.ip?.replace(/^::ffff:/, '')}</TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                        <Typography color="text.secondary">暂无审计日志</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', px: 2, py: 1, gap: 1 }}>
              <TablePagination
                component="div"
                count={total}
                page={page}
                rowsPerPage={rowsPerPage}
                onPageChange={handlePageChange}
                onRowsPerPageChange={handleRowsPerPageChange}
                rowsPerPageOptions={[20, 50, 100]}
                labelRowsPerPage="每页："
                labelDisplayedRows={({ from, to, count }) => `${from}-${to} / 共 ${count !== -1 ? count : `超过 ${to}`} 条`}
                sx={{ borderBottom: 'none' }}
              />
              {totalCount > 1 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 1 }}>
                  <Typography variant="body2" color="text.secondary">跳至</Typography>
                  <TextField
                    size="small"
                    value={pageInput}
                    onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={(e) => { if (e.key === 'Enter') handlePageJump(); }}
                    sx={{ width: 60, '& .MuiInputBase-input': { textAlign: 'center', py: 0.5, fontSize: '0.8rem' } }}
                  />
                  <Typography variant="body2" color="text.secondary">页</Typography>
                </Box>
              )}
            </Box>
          </>
        )}
      </Card>
    </Box>
  );
};

export default AuditLogPage;