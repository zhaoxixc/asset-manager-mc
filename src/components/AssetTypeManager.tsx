import React, { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Button, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, Chip, Tooltip, Snackbar, Alert, CircularProgress,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import useAuthStore from '../store/useAuthStore';
import api from '../services/api';
import { AssetTypeItem } from '../types';

interface AssetTypeManagerProps {
  globalSearch: string;
}

/** 资产类型管理组件 */
const AssetTypeManager: React.FC<AssetTypeManagerProps> = () => {
  const [types, setTypes] = useState<AssetTypeItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const { hasPermission } = useAuthStore();
  const canCreate = hasPermission('create');
  const canEdit = hasPermission('edit');
  const canDelete = hasPermission('delete');

  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [editingTypeId, setEditingTypeId] = useState<string>('');
  const [typeName, setTypeName] = useState<string>('');
  const [typeError, setTypeError] = useState<string>('');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

  const fetchTypes = async () => {
    setLoading(true);
    try {
      const res = await api.get('/asset-types');
      setTypes(res.data.data || []);
    } catch {
      setTypes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTypes();
  }, []);

  const handleAdd = () => {
    setEditingTypeId('');
    setTypeName('');
    setTypeError('');
    setDialogOpen(true);
  };

  const handleEdit = (id: string, name: string) => {
    setEditingTypeId(id);
    setTypeName(name);
    setTypeError('');
    setDialogOpen(true);
  };

  const handleDelete = async (id: string, name: string, assetCount: number) => {
    const msg = assetCount > 0
      ? `该类型下有 ${assetCount} 条资产，确定要删除吗？删除后资产将失去类型归属。`
      : `确定要删除资产类型"${name}"吗？`;
    if (window.confirm(msg)) {
      try {
        await api.delete(`/asset-types/${id}`);
        setSnackbar({ open: true, message: '删除成功', severity: 'success' });
        fetchTypes();
      } catch {
        setSnackbar({ open: true, message: '删除失败', severity: 'error' });
      }
    }
  };

  const handleSubmit = async () => {
    if (!typeName.trim()) {
      setTypeError('资产类型名称不能为空');
      return;
    }
    const duplicate = types.some((t) => t.name === typeName.trim() && t.id !== editingTypeId);
    if (duplicate) {
      setTypeError('资产类型名称已存在');
      return;
    }
    try {
      if (editingTypeId) {
        await api.put(`/asset-types/${editingTypeId}`, { name: typeName.trim() });
      } else {
        await api.post('/asset-types', { name: typeName.trim() });
      }
      setDialogOpen(false);
      setSnackbar({ open: true, message: '操作成功', severity: 'success' });
      fetchTypes();
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '操作失败';
      setTypeError(message);
    }
  };

  const getAssetCount = (type: AssetTypeItem): number => type.assetCount ?? 0;

  return (
    <Box>
      <Card elevation={0} sx={{ border: '1px solid #e8eaed', borderRadius: 2, mb: 2 }}>
        <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>资产类型列表（共 {types.length} 个类型）</Typography>
          <Tooltip title={!canCreate ? '您没有操作权限' : ''}>
            <span><Button variant="contained" size="small" startIcon={<AddIcon />} onClick={handleAdd} disabled={!canCreate} sx={{ textTransform: 'none' }}>新增类型</Button></span>
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
                  <TableCell sx={{ fontWeight: 600 }}>类型名称</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="center">资产数量</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>创建时间</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="center">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {types.length > 0 ? (
                  types.map((type) => (
                    <TableRow key={type.id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>{type.name}</Typography>
                          {getAssetCount(type) > 0 && <Chip label={`${getAssetCount(type)} 件`} size="small" sx={{ bgcolor: '#e8f0fe', color: '#1a73e8', fontSize: '0.7rem', height: 22 }} />}
                        </Box>
                      </TableCell>
                      <TableCell align="center">{getAssetCount(type)}</TableCell>
                      <TableCell>{type.createdAt}</TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                          <Tooltip title={!canEdit ? '您没有操作权限' : '编辑'}><span><IconButton size="small" color="primary" onClick={() => handleEdit(type.id, type.name)} disabled={!canEdit}><EditIcon fontSize="small" /></IconButton></span></Tooltip>
                          <Tooltip title={!canDelete ? '您没有操作权限' : '删除'}><span><IconButton size="small" color="error" onClick={() => handleDelete(type.id, type.name, getAssetCount(type))} disabled={!canDelete}><DeleteIcon fontSize="small" /></IconButton></span></Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={4} align="center" sx={{ py: 6 }}><Typography color="text.secondary">暂无资产类型数据</Typography></TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>{editingTypeId ? '编辑资产类型' : '新增资产类型'}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="类型名称" value={typeName} onChange={(e) => { setTypeName(e.target.value); setTypeError(''); }} error={!!typeError} helperText={typeError} size="small" sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ textTransform: 'none' }}>取消</Button>
          <Button variant="contained" onClick={handleSubmit} sx={{ textTransform: 'none' }}>{editingTypeId ? '保存' : '确认新增'}</Button>
        </DialogActions>
      </Dialog>
      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default AssetTypeManager;
