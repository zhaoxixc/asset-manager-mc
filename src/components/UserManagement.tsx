import React, { useState, useEffect } from 'react';
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
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Chip,
  Tooltip,
  Snackbar,
  Alert,
  CircularProgress,
  InputAdornment,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Lock as LockIcon,
  Person as PersonIcon,
  Sync as SyncIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import api from '../services/api';
import useAuthStore from '../store/useAuthStore';
import PaginationFooter from './PaginationFooter';
import { Role, UserStatus, roleLabels, User } from '../types';

/** 角色颜色映射 */
const roleColorMap: Record<string, { bg: string; color: string }> = {
  [Role.SUPER_ADMIN]: { bg: '#fce8e6', color: '#ea4335' },
  [Role.ADMIN]: { bg: '#e8f0fe', color: '#1a73e8' },
  [Role.USER]: { bg: '#e6f4ea', color: '#34a853' },
};

/** 状态颜色映射 */
const statusColorMap: Record<string, { bg: string; color: string }> = {
  [UserStatus.ACTIVE]: { bg: '#e6f4ea', color: '#34a853' },
  [UserStatus.DISABLED]: { bg: '#fce8e6', color: '#ea4335' },
};

interface UserManagementProps {
  globalSearch: string;
}

/** 用户管理组件 */
const UserManagement: React.FC<UserManagementProps> = ({ globalSearch }) => {
  const currentUser = useAuthStore((s) => s.currentUser);
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(20);

  // 对话框状态
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [editingUserId, setEditingUserId] = useState<string>('');
  const [formUsername, setFormUsername] = useState<string>('');
  const [formRealName, setFormRealName] = useState<string>('');
  const [formCnName, setFormCnName] = useState<string>('');
  const [formEmail, setFormEmail] = useState<string>('');
  const [formPassword, setFormPassword] = useState<string>('');
  const [formRole, setFormRole] = useState<Role>(Role.USER);
  const [formStatus, setFormStatus] = useState<UserStatus>(UserStatus.ACTIVE);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // 重置密码对话框
  const [resetDialogOpen, setResetDialogOpen] = useState<boolean>(false);
  const [resetUserId, setResetUserId] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [newPasswordError, setNewPasswordError] = useState<string>('');

  // 提示
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  // 加载用户列表
  useEffect(() => {
    fetchUsers();
  }, []);

  // 响应顶栏全局搜索
  useEffect(() => {
    setSearchKeyword(globalSearch);
    setPage(0);
  }, [globalSearch]);

  // 搜索过滤（用户名/真实姓名/邮箱）
  const keyword = searchKeyword.trim().toLowerCase();
  const filtered = keyword
    ? users.filter((u) => [u.username, u.realName, u.email].some((f) => (f || '').toLowerCase().includes(keyword)))
    : users;
  const safePage = Math.min(page, Math.max(0, Math.ceil(filtered.length / rowsPerPage) - 1));
  const pagedUsers = filtered.slice(safePage * rowsPerPage, safePage * rowsPerPage + rowsPerPage);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data.data);
    } catch {
      setSnackbar({ open: true, message: '获取用户列表失败', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  if (!isSuperAdmin()) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <Alert severity="error" sx={{ maxWidth: 400 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>无权访问</Typography>
          您没有访问用户管理页面的权限，请联系超级管理员。
        </Alert>
      </Box>
    );
  }

  /** 从LDAP同步用户 */
  const handleSyncLdap = async () => {
    setSyncing(true);
    try {
      const res = await api.post('/users/sync-ldap');
      const { fetched, created, updated } = res.data.data || {};
      setSnackbar({ open: true, message: `同步完成：拉取 ${fetched} 个用户，新建 ${created}，更新 ${updated}`, severity: 'success' });
      await fetchUsers();
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '同步失败';
      setSnackbar({ open: true, message, severity: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  /** 打开新增对话框 */
  const handleAdd = () => {
    setEditingUserId('');
    setFormUsername('');
    setFormRealName('');
    setFormCnName('');
    setFormEmail('');
    setFormPassword('');
    setFormRole(Role.USER);
    setFormStatus(UserStatus.ACTIVE);
    setFormErrors({});
    setDialogOpen(true);
  };

  /** 打开编辑对话框 */
  const handleEdit = (user: User) => {
    setEditingUserId(user.id);
    setFormUsername(user.username);
    setFormRealName(user.realName);
    setFormCnName(user.cnName || '');
    setFormEmail(user.email || '');
    setFormPassword('');
    setFormRole(user.role);
    setFormStatus(user.status);
    setFormErrors({});
    setDialogOpen(true);
  };

  /** 删除用户 */
  const handleDelete = async (user: User) => {
    if (user.id === currentUser?.id) {
      setSnackbar({ open: true, message: '不能删除当前登录的用户', severity: 'error' });
      return;
    }
    if (window.confirm(`确定要删除用户"${user.realName}"吗？`)) {
      try {
        await api.delete(`/users/${user.id}`);
        await fetchUsers();
        setSnackbar({ open: true, message: '删除成功', severity: 'success' });
      } catch {
        setSnackbar({ open: true, message: '删除失败', severity: 'error' });
      }
    }
  };

  /** 打开重置密码对话框 */
  const handleResetPassword = (userId: string) => {
    setResetUserId(userId);
    setNewPassword('');
    setNewPasswordError('');
    setResetDialogOpen(true);
  };

  /** 确认重置密码 */
  const handleConfirmReset = async () => {
    if (!newPassword.trim() || newPassword.length < 4) {
      setNewPasswordError('密码长度不能少于4位');
      return;
    }
    try {
      await api.put(`/users/${resetUserId}/reset-password`, { newPassword: newPassword.trim() });
      setResetDialogOpen(false);
      setSnackbar({ open: true, message: '密码重置成功', severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: '密码重置失败', severity: 'error' });
    }
  };

  /** 提交表单 */
  const handleSubmit = async () => {
    const errors: Record<string, string> = {};
    if (!formUsername.trim()) errors.username = '用户名不能为空';
    if (!formRealName.trim()) errors.realName = '真实姓名不能为空';
    if (formEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formEmail.trim())) errors.email = '邮箱格式不正确';
    if (!editingUserId && !formPassword.trim()) errors.password = '密码不能为空';
    if (formPassword && formPassword.length < 4) errors.password = '密码长度不能少于4位';

    if (editingUserId === currentUser?.id) {
      if (formRole !== currentUser.role) {
        setSnackbar({ open: true, message: '不能修改自己的角色', severity: 'error' });
        return;
      }
      if (formStatus === UserStatus.DISABLED) {
        setSnackbar({ open: true, message: '不能禁用自己的账号', severity: 'error' });
        return;
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      if (editingUserId) {
        const updates: Record<string, string> = {
          realName: formRealName.trim(),
          cnName: formCnName.trim(),
          email: formEmail.trim(),
          role: formRole,
          status: formStatus,
        };
        if (formPassword) updates.password = formPassword;
        await api.put(`/users/${editingUserId}`, updates);
        setSnackbar({ open: true, message: '用户更新成功', severity: 'success' });
      } else {
        await api.post('/users', {
          username: formUsername.trim(),
          password: formPassword,
          realName: formRealName.trim(),
          cnName: formCnName.trim(),
          email: formEmail.trim(),
          role: formRole,
          status: formStatus,
        });
        setSnackbar({ open: true, message: '用户创建成功', severity: 'success' });
      }
      setDialogOpen(false);
      await fetchUsers();
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '操作失败';
      if (message.includes('已存在')) {
        setFormErrors({ username: message });
      } else {
        setSnackbar({ open: true, message, severity: 'error' });
      }
    }
  };

  return (
    <Box>
      {/* 工具栏 */}
      <Card elevation={0} sx={{ border: '1px solid #e8eaed', borderRadius: 2, mb: 2 }}>
        <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5, '&:last-child': { pb: 1.5 }, gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {keyword ? `筛选出 ${filtered.length} / ${users.length} 个用户` : `用户列表（共 ${users.length} 个用户）`}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              size="small"
              placeholder="搜索用户名/姓名/邮箱"
              value={searchKeyword}
              onChange={(e) => { setSearchKeyword(e.target.value); setPage(0); }}
              InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>) }}
              sx={{ width: 240 }}
            />
            <Button
              variant="outlined"
              size="small"
              startIcon={syncing ? <CircularProgress size={14} /> : <SyncIcon />}
              disabled={syncing}
              onClick={handleSyncLdap}
              sx={{ textTransform: 'none' }}
            >
              {syncing ? '同步中…' : '从LDAP同步用户'}
            </Button>
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={handleAdd} sx={{ textTransform: 'none' }}>
              新增用户
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* 用户表格 */}
      <Card elevation={0} sx={{ border: '1px solid #e8eaed', borderRadius: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>用户名</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>真实姓名</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>中文姓名</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>邮箱</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="center">角色</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="center">状态</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>创建时间</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="center">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pagedUsers.length > 0 ? (
                  pagedUsers.map((user) => {
                    const rc = roleColorMap[user.role] || { bg: '#f5f5f5', color: '#757575' };
                    const sc = statusColorMap[user.status] || { bg: '#f5f5f5', color: '#757575' };
                    const isSelf = user.id === currentUser?.id;
                    return (
                      <TableRow key={user.id} hover>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <PersonIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>{user.username}</Typography>
                            {user.authSource === 'ldap' && <Chip label="LDAP" size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#f3e8fd', color: '#8430ce' }} />}
                            {isSelf && <Chip label="当前" size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#e8f0fe', color: '#1a73e8' }} />}
                          </Box>
                        </TableCell>
                        <TableCell>{user.realName}</TableCell>
                        <TableCell>{user.cnName || '-'}</TableCell>
                        <TableCell>
                          {user.email ? (
                            <Tooltip title={user.email}>
                              <Typography variant="body2" sx={{ color: 'text.secondary' }}>{user.email}</Typography>
                            </Tooltip>
                          ) : (
                            <Typography variant="body2" sx={{ color: 'text.disabled' }}>-</Typography>
                          )}
                        </TableCell>
                        <TableCell align="center">
                          <Chip label={roleLabels[user.role as Role]} size="small" sx={{ bgcolor: rc.bg, color: rc.color, fontWeight: 600, fontSize: '0.75rem' }} />
                        </TableCell>
                        <TableCell align="center">
                          <Chip label={user.status === UserStatus.ACTIVE ? '启用' : '禁用'} size="small" sx={{ bgcolor: sc.bg, color: sc.color, fontWeight: 600, fontSize: '0.75rem' }} />
                        </TableCell>
                        <TableCell>{user.createdAt}</TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                            <Tooltip title="编辑"><IconButton size="small" color="primary" onClick={() => handleEdit(user)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                            <Tooltip title={user.authSource === 'ldap' ? 'LDAP账号密码由统一认证管理' : '重置密码'}>
                              <span><IconButton size="small" color="warning" disabled={user.authSource === 'ldap'} onClick={() => handleResetPassword(user.id)}><LockIcon fontSize="small" /></IconButton></span>
                            </Tooltip>
                            <Tooltip title="删除"><span><IconButton size="small" color="error" disabled={isSelf} onClick={() => handleDelete(user)}><DeleteIcon fontSize="small" /></IconButton></span></Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                      <Typography color="text.secondary">{keyword ? '未找到匹配的用户' : '暂无用户数据'}</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <PaginationFooter
              count={filtered.length}
              page={safePage}
              rowsPerPage={rowsPerPage}
              onPageChange={setPage}
              onRowsPerPageChange={(n) => { setRowsPerPage(n); setPage(0); }}
              onJumpError={(m) => setSnackbar({ open: true, message: m, severity: 'error' })}
            />
          </TableContainer>
        )}
      </Card>

      {/* 新增/编辑用户对话框 */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>{editingUserId ? '编辑用户' : '新增用户'}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="用户名" value={formUsername} onChange={(e) => { setFormUsername(e.target.value); setFormErrors((prev) => ({ ...prev, username: '' })); }} error={!!formErrors.username} helperText={formErrors.username} disabled={!!editingUserId} size="small" sx={{ mt: 1, mb: 2 }} />
          <TextField fullWidth label="真实姓名" value={formRealName} onChange={(e) => { setFormRealName(e.target.value); setFormErrors((prev) => ({ ...prev, realName: '' })); }} error={!!formErrors.realName} helperText={formErrors.realName} size="small" sx={{ mb: 2 }} />
          <TextField
            fullWidth
            label="中文姓名（使用人名）"
            value={formCnName}
            onChange={(e) => setFormCnName(e.target.value)}
            helperText="用于与资产登记的使用人关联，LDAP同步不会覆盖"
            size="small"
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="邮箱"
            type="email"
            value={formEmail}
            onChange={(e) => { setFormEmail(e.target.value); setFormErrors((prev) => ({ ...prev, email: '' })); }}
            error={!!formErrors.email}
            helperText={formErrors.email || (users.find((u) => u.id === editingUserId)?.authSource === 'ldap' ? 'LDAP同步时若目录中存在邮箱则会覆盖此值' : '选填')}
            size="small"
            sx={{ mb: 2 }}
          />
          <TextField fullWidth label={editingUserId ? '新密码（留空则不修改）' : '密码'} type="password" value={formPassword} onChange={(e) => { setFormPassword(e.target.value); setFormErrors((prev) => ({ ...prev, password: '' })); }} error={!!formErrors.password} helperText={formErrors.password} size="small" sx={{ mb: 2 }} />
          <TextField fullWidth select label="角色" value={formRole} onChange={(e) => setFormRole(e.target.value as Role)} size="small" sx={{ mb: 2 }} disabled={editingUserId === currentUser?.id} helperText={editingUserId === currentUser?.id ? '不能修改自己的角色' : ''}>
            {Object.entries(roleLabels).map(([value, label]) => (<MenuItem key={value} value={value}>{label}</MenuItem>))}
          </TextField>
          <TextField fullWidth select label="状态" value={formStatus} onChange={(e) => setFormStatus(e.target.value as UserStatus)} size="small" disabled={editingUserId === currentUser?.id} helperText={editingUserId === currentUser?.id ? '不能禁用自己的账号' : ''}>
            <MenuItem value={UserStatus.ACTIVE}>启用</MenuItem>
            <MenuItem value={UserStatus.DISABLED}>禁用</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ textTransform: 'none' }}>取消</Button>
          <Button variant="contained" onClick={handleSubmit} sx={{ textTransform: 'none' }}>{editingUserId ? '保存' : '确认新增'}</Button>
        </DialogActions>
      </Dialog>

      {/* 重置密码对话框 */}
      <Dialog open={resetDialogOpen} onClose={() => setResetDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>重置密码</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="新密码" type="password" value={newPassword} onChange={(e) => { setNewPassword(e.target.value); setNewPasswordError(''); }} error={!!newPasswordError} helperText={newPasswordError || '密码长度不能少于4位'} size="small" sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setResetDialogOpen(false)} sx={{ textTransform: 'none' }}>取消</Button>
          <Button variant="contained" onClick={handleConfirmReset} sx={{ textTransform: 'none' }}>确认重置</Button>
        </DialogActions>
      </Dialog>

      {/* 提示消息 */}
      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default UserManagement;
