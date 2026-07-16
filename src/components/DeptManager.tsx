import React, { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Button, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, Chip, Tooltip, Snackbar, Alert, CircularProgress,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import useDeptStore from '../store/useDeptStore';
import useAuthStore from '../store/useAuthStore';
import { Department } from '../types';

interface DeptManagerProps {
  globalSearch: string;
}

/** 部门管理组件 */
const DeptManager: React.FC<DeptManagerProps> = () => {
  const departments = useDeptStore((s) => s.departments);
  const addDept = useDeptStore((s) => s.addDept);
  const updateDept = useDeptStore((s) => s.updateDept);
  const deleteDept = useDeptStore((s) => s.deleteDept);
  const fetchDepartments = useDeptStore((s) => s.fetchDepartments);
  const loading = useDeptStore((s) => s.loading);
  const { hasPermission } = useAuthStore();
  const canCreate = hasPermission('create');
  const canEdit = hasPermission('edit');
  const canDelete = hasPermission('delete');

  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [editingDeptId, setEditingDeptId] = useState<string>('');
  const [deptName, setDeptName] = useState<string>('');
  const [deptError, setDeptError] = useState<string>('');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const handleAdd = () => {
    setEditingDeptId('');
    setDeptName('');
    setDeptError('');
    setDialogOpen(true);
  };

  const handleEdit = (id: string, name: string) => {
    setEditingDeptId(id);
    setDeptName(name);
    setDeptError('');
    setDialogOpen(true);
  };

  const handleDelete = async (id: string, name: string, assetCount: number) => {
    const msg = assetCount > 0
      ? `该部门下有 ${assetCount} 条资产，确定要删除吗？删除后资产将失去部门归属。`
      : `确定要删除部门"${name}"吗？`;
    if (window.confirm(msg)) {
      const success = await deleteDept(id);
      setSnackbar({ open: true, message: success ? '删除成功' : '删除失败', severity: success ? 'success' : 'error' });
    }
  };

  const handleSubmit = async () => {
    if (!deptName.trim()) {
      setDeptError('部门名称不能为空');
      return;
    }
    const duplicate = departments.some((d) => d.name === deptName.trim() && d.id !== editingDeptId);
    if (duplicate) {
      setDeptError('部门名称已存在');
      return;
    }
    let success: boolean;
    if (editingDeptId) {
      success = await updateDept(editingDeptId, deptName.trim());
    } else {
      success = await addDept(deptName.trim());
    }
    setDialogOpen(false);
    setSnackbar({ open: true, message: success ? '操作成功' : '操作失败', severity: success ? 'success' : 'error' });
  };

  const getAssetCount = (dept: Department): number => dept.assetCount ?? 0;

  return (
    <Box>
      <Card elevation={0} sx={{ border: '1px solid #e8eaed', borderRadius: 2, mb: 2 }}>
        <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>部门列表（共 {departments.length} 个部门）</Typography>
          <Tooltip title={!canCreate ? '您没有操作权限' : ''}>
            <span><Button variant="contained" size="small" startIcon={<AddIcon />} onClick={handleAdd} disabled={!canCreate} sx={{ textTransform: 'none' }}>新增部门</Button></span>
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
                  <TableCell sx={{ fontWeight: 600 }}>部门名称</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="center">资产数量</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>创建时间</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="center">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {departments.length > 0 ? (
                  departments.map((dept) => (
                    <TableRow key={dept.id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>{dept.name}</Typography>
                          {getAssetCount(dept) > 0 && <Chip label={`${getAssetCount(dept)} 件`} size="small" sx={{ bgcolor: '#e8f0fe', color: '#1a73e8', fontSize: '0.7rem', height: 22 }} />}
                        </Box>
                      </TableCell>
                      <TableCell align="center">{getAssetCount(dept)}</TableCell>
                      <TableCell>{dept.createdAt}</TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                          <Tooltip title={!canEdit ? '您没有操作权限' : '编辑'}><span><IconButton size="small" color="primary" onClick={() => handleEdit(dept.id, dept.name)} disabled={!canEdit}><EditIcon fontSize="small" /></IconButton></span></Tooltip>
                          <Tooltip title={!canDelete ? '您没有操作权限' : '删除'}><span><IconButton size="small" color="error" onClick={() => handleDelete(dept.id, dept.name, getAssetCount(dept))} disabled={!canDelete}><DeleteIcon fontSize="small" /></IconButton></span></Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={4} align="center" sx={{ py: 6 }}><Typography color="text.secondary">暂无部门数据</Typography></TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>{editingDeptId ? '编辑部门' : '新增部门'}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="部门名称" value={deptName} onChange={(e) => { setDeptName(e.target.value); setDeptError(''); }} error={!!deptError} helperText={deptError} size="small" sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ textTransform: 'none' }}>取消</Button>
          <Button variant="contained" onClick={handleSubmit} sx={{ textTransform: 'none' }}>{editingDeptId ? '保存' : '确认新增'}</Button>
        </DialogActions>
      </Dialog>
      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default DeptManager;
