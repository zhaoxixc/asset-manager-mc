import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  Snackbar,
} from '@mui/material';
import api from '../services/api';

interface ChangePasswordDialogProps {
  open: boolean;
  onClose: () => void;
}

/** 修改密码对话框 */
const ChangePasswordDialog: React.FC<ChangePasswordDialogProps> = ({ open, onClose }) => {
  const [oldPassword, setOldPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  /** 提交修改密码 */
  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {};

    if (!oldPassword) newErrors.oldPassword = '请输入原密码';
    if (!newPassword) { newErrors.newPassword = '请输入新密码'; }
    else if (newPassword.length < 6) newErrors.newPassword = '新密码长度不能少于6位';
    else if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(newPassword)) newErrors.newPassword = '新密码需包含字母和数字';
    if (newPassword !== confirmPassword) newErrors.confirmPassword = '两次输入的密码不一致';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      await api.put('/auth/password', { oldPassword, newPassword });
      setSnackbar({ open: true, message: '密码修改成功', severity: 'success' });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setErrors({});
      onClose();
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '密码修改失败';
      setSnackbar({ open: true, message, severity: 'error' });
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>修改密码</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="原密码"
            type="password"
            value={oldPassword}
            onChange={(e) => { setOldPassword(e.target.value); setErrors((prev) => ({ ...prev, oldPassword: '' })); }}
            error={!!errors.oldPassword}
            helperText={errors.oldPassword}
            size="small"
            sx={{ mt: 1, mb: 2 }}
          />
          <TextField
            fullWidth
            label="新密码"
            type="password"
            value={newPassword}
            onChange={(e) => { setNewPassword(e.target.value); setErrors((prev) => ({ ...prev, newPassword: '' })); }}
            error={!!errors.newPassword}
            helperText={errors.newPassword || '密码需6位以上，包含字母和数字'}
            size="small"
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="确认新密码"
            type="password"
            value={confirmPassword}
            onChange={(e) => { setConfirmPassword(e.target.value); setErrors((prev) => ({ ...prev, confirmPassword: '' })); }}
            error={!!errors.confirmPassword}
            helperText={errors.confirmPassword}
            size="small"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} sx={{ textTransform: 'none' }}>取消</Button>
          <Button variant="contained" onClick={handleSubmit} sx={{ textTransform: 'none' }}>确认修改</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default ChangePasswordDialog;
