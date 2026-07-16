import React, { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Button, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, Chip, Tooltip, Snackbar, Alert, CircularProgress,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import useAuthStore from '../store/useAuthStore';
import api from '../services/api';
import { AssetStatusItem } from '../types';

interface AssetStatusManagerProps {
  globalSearch: string;
}

const AssetStatusManager: React.FC<AssetStatusManagerProps> = () => {
  const [statuses, setStatuses] = useState<AssetStatusItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const { hasPermission } = useAuthStore();
  const canCreate = hasPermission('create');
  const canEdit = hasPermission('edit');
  const canDelete = hasPermission('delete');

  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string>('');
  const [sName, setSName] = useState<string>('');
  const [sColor, setSColor] = useState<string>('#757575');
  const [sError, setSError] = useState<string>('');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

  const fetchStatuses = async () => {
    setLoading(true);
    try {
      const res = await api.get('/asset-statuses');
      setStatuses(res.data.data || []);
    } catch {
      setStatuses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStatuses(); }, []);

  const handleAdd = () => {
    setEditingId('');
    setSName('');
    setSColor('#757575');
    setSError('');
    setDialogOpen(true);
  };

  const handleEdit = (id: string, name: string, color: string) => {
    setEditingId(id);
    setSName(name);
    setSColor(color);
    setSError('');
    setDialogOpen(true);
  };

  const handleDelete = async (id: string, name: string, assetCount: number) => {
    const msg = assetCount > 0
      ? `该状态下有 ${assetCount} 条资产，确定要删除吗？删除后资产将失去状态归属。`
      : `确定要删除资产状态"${name}"吗？`;
    if (window.confirm(msg)) {
      try {
        await api.delete(`/asset-statuses/${id}`);
        setSnackbar({ open: true, message: '删除成功', severity: 'success' });
        fetchStatuses();
      } catch {
        setSnackbar({ open: true, message: '删除失败', severity: 'error' });
      }
    }
  };

  const handleSubmit = async () => {
    if (!sName.trim()) { setSError('名称不能为空'); return; }
    const duplicate = statuses.some((s) => s.name === sName.trim() && s.id !== editingId);
    if (duplicate) { setSError('名称已存在'); return; }
    try {
      if (editingId) {
        await api.put(`/asset-statuses/${editingId}`, { name: sName.trim(), color: sColor });
      } else {
        await api.post('/asset-statuses', { name: sName.trim(), color: sColor });
      }
      setDialogOpen(false);
      setSnackbar({ open: true, message: '操作成功', severity: 'success' });
      fetchStatuses();
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '操作失败';
      setSError(message);
    }
  };

  const getAssetCount = (status: AssetStatusItem): number => status.assetCount ?? 0;

  return (
    <Box>
      <Card elevation={0} sx={{ border: '1px solid #e8eaed', borderRadius: 2, mb: 2 }}>
        <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>资产状态管理（共 {statuses.length} 个状态）</Typography>
          <Tooltip title={!canEdit ? '您没有操作权限' : ''}>
            <span><Button variant="contained" size="small" startIcon={<AddIcon />} onClick={handleAdd} disabled={!canCreate} sx={{ textTransform: 'none' }}>新增状态</Button></span>
          </Tooltip>
        </CardContent>
      </Card>
      <Card elevation={0} sx={{ border: '1px solid #e8eaed', borderRadius: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>状态名称</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="center">颜色预览</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="center">资产数量</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>创建时间</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="center">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {statuses.length > 0 ? (
                  statuses.map((status) => (
                    <TableRow key={status.id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>{status.name}</Typography>
                          {getAssetCount(status) > 0 && <Chip label={`${getAssetCount(status)} 件`} size="small" sx={{ bgcolor: `${status.color}20`, color: status.color, fontSize: '0.7rem', height: 22 }} />}
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                          <Box sx={{ width: 24, height: 24, borderRadius: 1, bgcolor: status.color }} />
                        </Box>
                      </TableCell>
                      <TableCell align="center">{getAssetCount(status)}</TableCell>
                      <TableCell>{status.createdAt}</TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                          <Tooltip title={!canEdit ? '您没有操作权限' : '编辑'}><span><IconButton size="small" color="primary" onClick={() => handleEdit(status.id, status.name, status.color)} disabled={!canEdit}><EditIcon fontSize="small" /></IconButton></span></Tooltip>
                          <Tooltip title={!canDelete ? '您没有操作权限' : '删除'}><span><IconButton size="small" color="error" onClick={() => handleDelete(status.id, status.name, getAssetCount(status))} disabled={!canDelete}><DeleteIcon fontSize="small" /></IconButton></span></Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={5} align="center" sx={{ py: 6 }}><Typography color="text.secondary">暂无资产状态数据</Typography></TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>{editingId ? '编辑资产状态' : '新增资产状态'}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="状态名称" value={sName} onChange={(e) => { setSName(e.target.value); setSError(''); }} error={!!sError} helperText={sError} size="small" sx={{ mt: 1, mb: 2 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <TextField label="颜色" type="color" value={sColor} onChange={(e) => setSColor(e.target.value)} size="small" sx={{ width: 80 }} />
            <Chip label={sName || '预览'} size="small" sx={{ bgcolor: `${sColor}20`, color: sColor, fontWeight: 600 }} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ textTransform: 'none' }}>取消</Button>
          <Button variant="contained" onClick={handleSubmit} sx={{ textTransform: 'none' }}>{editingId ? '保存' : '确认新增'}</Button>
        </DialogActions>
      </Dialog>
      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default AssetStatusManager;