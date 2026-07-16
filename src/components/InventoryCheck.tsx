import React, { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Chip, Select,
  InputLabel, FormControl, IconButton, Tooltip, CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon, CheckCircle as CheckedIcon,
  Cancel as UncheckedIcon, Warning as AbnormalIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import useInventoryStore from '../store/useInventoryStore';
import useAuthStore from '../store/useAuthStore';
import useDeptStore from '../store/useDeptStore';
import { InventoryTask, InventoryStatus } from '../types';

const inventoryStatusMap: Record<string, { bg: string; color: string }> = {
  '已盘点': { bg: '#e6f4ea', color: '#34a853' },
  '未盘点': { bg: '#fef3e2', color: '#ff6d00' },
  '异常': { bg: '#fce8e6', color: '#ea4335' },
};

interface InventoryCheckProps {
  globalSearch: string;
}

const InventoryCheck: React.FC<InventoryCheckProps> = () => {
  const tasks = useInventoryStore((s) => s.tasks);
  const fetchTasks = useInventoryStore((s) => s.fetchTasks);
  const createTask = useInventoryStore((s) => s.createTask);
  const updateRecordStatus = useInventoryStore((s) => s.updateRecordStatus);
  const deleteTask = useInventoryStore((s) => s.deleteTask);
  const loading = useInventoryStore((s) => s.loading);
  const { hasPermission } = useAuthStore();
  const canCreate = hasPermission('create');
  const canEdit = hasPermission('edit');
  const canDelete = hasPermission('delete');

  // 从 useDeptStore 获取部门列表
  const departments = useDeptStore((s) => s.departments);

  const [createDialogOpen, setCreateDialogOpen] = useState<boolean>(false);
  const [taskName, setTaskName] = useState<string>('');
  const [taskDept, setTaskDept] = useState<string>('');
  const [taskNameError, setTaskNameError] = useState<string>('');
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const activeTask = activeTaskId ? tasks.find((t) => t.id === activeTaskId) || null : null;

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleCreateTask = async () => {
    if (!taskName.trim()) { setTaskNameError('任务名称不能为空'); return; }
    setTaskNameError('');
    const success = await createTask(taskName.trim(), taskDept);
    if (success) {
      setCreateDialogOpen(false);
      setTaskName('');
      setTaskDept('');
    }
  };

  const handleUpdateStatus = async (taskId: string, recordId: string, status: InventoryStatus, remark: string = '') => {
    await updateRecordStatus(taskId, recordId, status, remark);
  };

  const handleDeleteTask = async (taskId: string, taskName: string) => {
    if (window.confirm(`确定要删除盘点任务"${taskName}"吗？删除后关联的盘点记录也将被删除。`)) {
      await deleteTask(taskId);
    }
  };

  const getTaskProgress = (task: InventoryTask) => {
    const total = task.records?.length || 0;
    const checked = task.records?.filter((r) => r.status !== InventoryStatus.UNCHECKED).length || 0;
    const abnormal = task.records?.filter((r) => r.status === InventoryStatus.ABNORMAL).length || 0;
    return { total, checked, abnormal, percent: total > 0 ? Math.round((checked / total) * 100) : 0 };
  };

  return (
    <Box>
      <Card elevation={0} sx={{ border: '1px solid #e8eaed', borderRadius: 2, mb: 2 }}>
        <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>盘点任务（共 {tasks.length} 个）</Typography>
          <Tooltip title={!canCreate ? '您没有操作权限' : ''}>
            <span><Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setCreateDialogOpen(true)} disabled={!canCreate} sx={{ textTransform: 'none' }}>创建盘点任务</Button></span>
          </Tooltip>
        </CardContent>
      </Card>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : activeTask ? (
        <Card elevation={0} sx={{ border: '1px solid #e8eaed', borderRadius: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>{activeTask.name}</Typography>
                <Typography variant="body2" color="text.secondary">盘点范围：{activeTask.department} · 创建时间：{activeTask.createdAt}</Typography>
              </Box>
              <Button variant="outlined" size="small" onClick={() => setActiveTaskId(null)} sx={{ textTransform: 'none' }}>返回列表</Button>
            </Box>
            <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ flex: 1, bgcolor: '#e8eaed', borderRadius: 1, height: 8 }}>
                <Box sx={{ width: `${getTaskProgress(activeTask).percent}%`, bgcolor: 'primary.main', borderRadius: 1, height: 8, transition: 'width 0.3s' }} />
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main', minWidth: 50 }}>{getTaskProgress(activeTask).percent}%</Typography>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>资产编号</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>资产名称</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>部门</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="center">盘点状态</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>盘点时间</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>备注</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="center">操作</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {activeTask.records?.map((record) => {
                    const sMap = inventoryStatusMap[record.status] || inventoryStatusMap['未盘点'];
                    return (
                      <TableRow key={record.id} hover>
                        <TableCell><Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{record.assetCode}</Typography></TableCell>
                        <TableCell>{record.assetName}</TableCell>
                        <TableCell>{record.department}</TableCell>
                        <TableCell align="center"><Chip label={record.status} size="small" sx={{ bgcolor: sMap.bg, color: sMap.color, fontWeight: 600, fontSize: '0.75rem' }} /></TableCell>
                        <TableCell>{record.checkedAt || '-'}</TableCell>
                        <TableCell>{record.remark || '-'}</TableCell>
                        <TableCell align="center">
                          {record.status === InventoryStatus.UNCHECKED ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                              <Tooltip title={!canEdit ? '您没有操作权限' : '标记已盘点'}><span><IconButton size="small" color="success" disabled={!canEdit} onClick={() => handleUpdateStatus(activeTask.id, record.id, InventoryStatus.CHECKED, '')}><CheckedIcon fontSize="small" /></IconButton></span></Tooltip>
                              <Tooltip title={!canEdit ? '您没有操作权限' : '标记异常'}><span><IconButton size="small" color="error" disabled={!canEdit} onClick={() => handleUpdateStatus(activeTask.id, record.id, InventoryStatus.ABNORMAL, '盘点异常')}><AbnormalIcon fontSize="small" /></IconButton></span></Tooltip>
                            </Box>
                          ) : (
                            <Tooltip title={!canEdit ? '您没有操作权限' : '重置为未盘点'}><span><IconButton size="small" disabled={!canEdit} onClick={() => handleUpdateStatus(activeTask.id, record.id, InventoryStatus.UNCHECKED, '')}><UncheckedIcon fontSize="small" /></IconButton></span></Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      ) : (
        <Card elevation={0} sx={{ border: '1px solid #e8eaed', borderRadius: 2 }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>任务名称</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>盘点范围</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="center">资产总数</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="center">已盘点</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="center">异常</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="center">进度</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>创建时间</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="center">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tasks.length > 0 ? (
                  tasks.map((task) => {
                    const progress = getTaskProgress(task);
                    return (
                      <TableRow key={task.id} hover>
                        <TableCell><Typography variant="body2" sx={{ fontWeight: 500 }}>{task.name}</Typography></TableCell>
                        <TableCell>{task.department}</TableCell>
                        <TableCell align="center">{progress.total}</TableCell>
                        <TableCell align="center">{progress.checked}</TableCell>
                        <TableCell align="center">{progress.abnormal > 0 ? <Chip label={progress.abnormal} size="small" sx={{ bgcolor: '#fce8e6', color: '#ea4335', fontWeight: 600 }} /> : 0}</TableCell>
                        <TableCell align="center"><Typography variant="body2" sx={{ fontWeight: 600, color: progress.percent === 100 ? '#34a853' : '#1a73e8' }}>{progress.percent}%</Typography></TableCell>
                        <TableCell>{task.createdAt}</TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0.5 }}>
                            <Button size="small" variant="outlined" onClick={() => setActiveTaskId(task.id)} sx={{ textTransform: 'none' }}>查看详情</Button>
                            <Tooltip title={!canDelete ? '您没有操作权限' : '删除任务'}>
                              <span>
                                <IconButton size="small" color="error" disabled={!canDelete} onClick={() => handleDeleteTask(task.id, task.name)}>
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow><TableCell colSpan={8} align="center" sx={{ py: 6 }}><Typography color="text.secondary">暂无盘点任务</Typography></TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>创建盘点任务</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="任务名称" value={taskName} onChange={(e) => { setTaskName(e.target.value); setTaskNameError(''); }} error={!!taskNameError} helperText={taskNameError} size="small" sx={{ mt: 1, mb: 2 }} />
          <FormControl fullWidth size="small">
            <InputLabel>盘点部门</InputLabel>
            <Select label="盘点部门" value={taskDept} onChange={(e) => setTaskDept(e.target.value)}>
              <MenuItem value="">全部部门</MenuItem>
              {departments.map((d) => (<MenuItem key={d.id} value={d.name}>{d.name}</MenuItem>))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setCreateDialogOpen(false)} sx={{ textTransform: 'none' }}>取消</Button>
          <Button variant="contained" onClick={handleCreateTask} sx={{ textTransform: 'none' }}>确认创建</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default InventoryCheck;
