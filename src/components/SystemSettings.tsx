import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  Divider,
  Snackbar,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tooltip,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import {
  FileDownload as ExportIcon,
  FileUpload as ImportIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import api from '../services/api';
import { CodePrefixItem } from '../types';

interface SystemSettingsProps {
  globalSearch: string;
}

const SystemSettings: React.FC<SystemSettingsProps> = () => {
  const [exportLoading, setExportLoading] = useState<boolean>(false);
  const [importLoading, setImportLoading] = useState<boolean>(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({ open: false, message: '', severity: 'info' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 企业信息
  const [companyName, setCompanyName] = useState<string>('');
  const [companyLogo, setCompanyLogo] = useState<string>('');
  const [logoUploading, setLogoUploading] = useState<boolean>(false);
  const [auditLogCleanupEnabled, setAuditLogCleanupEnabled] = useState<boolean>(false);
  const [auditLogRetentionDays, setAuditLogRetentionDays] = useState<number>(365);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [prefixes, setPrefixes] = useState<CodePrefixItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string>('');
  const [prefixDept, setPrefixDept] = useState<string>('');
  const [prefixValue, setPrefixValue] = useState<string>('');
  const [prefixSuffix, setPrefixSuffix] = useState<string>('');
  const [prefixNumberWidth, setPrefixNumberWidth] = useState<number>(4);
  const [prefixError, setPrefixError] = useState<string>('');

  useEffect(() => {
    fetchPrefixes();
    fetchSystemInfo();
  }, []);

  const fetchSystemInfo = async () => {
    try {
      const res = await api.get('/system-info');
      const data = res.data.data || {};
      setCompanyName(data.company_name || '');
      setCompanyLogo(data.company_logo || '');
      setAuditLogCleanupEnabled(data.audit_log_cleanup_enabled === 'true');
      setAuditLogRetentionDays(parseInt(data.audit_log_retention_days, 10) || 365);
    } catch { /* ignore */ }
  };

  const fetchPrefixes = async () => {
    try {
      const res = await api.get('/code-prefixes');
      setPrefixes(res.data.data || []);
    } catch {
      setPrefixes([]);
    }
  };

  const handleAddPrefix = () => {
    setEditingId('');
    setPrefixDept('');
    setPrefixValue('');
    setPrefixSuffix('');
    setPrefixNumberWidth(4);
    setPrefixError('');
    setDialogOpen(true);
  };

  const handleEditPrefix = (p: CodePrefixItem) => {
    setEditingId(p.id);
    setPrefixDept(p.department);
    setPrefixValue(p.prefix);
    setPrefixSuffix(p.suffix || '');
    setPrefixNumberWidth(p.numberWidth || 4);
    setPrefixError('');
    setDialogOpen(true);
  };

  const handleDeletePrefix = async (id: string, prefix: string) => {
    if (!window.confirm(`确定要删除编号前缀"${prefix}"吗？`)) return;
    try {
      await api.delete(`/code-prefixes/${id}`);
      setSnackbar({ open: true, message: '删除成功', severity: 'success' });
      fetchPrefixes();
    } catch {
      setSnackbar({ open: true, message: '删除失败', severity: 'error' });
    }
  };

  const handleSubmitPrefix = async () => {
    if (!prefixValue.trim()) { setPrefixError('编号前缀不能为空'); return; }
    if (!/^[A-Za-z0-9\-_]+$/.test(prefixValue.trim())) { setPrefixError('前缀只能包含字母、数字、横杠和下划线'); return; }
    if (prefixNumberWidth < 3 || prefixNumberWidth > 8) { setPrefixError('序号位数必须在3-8之间'); return; }
    try {
      if (editingId) {
        await api.put(`/code-prefixes/${editingId}`, { department: prefixDept.trim(), prefix: prefixValue.trim(), suffix: prefixSuffix.trim(), numberWidth: prefixNumberWidth });
      } else {
        await api.post('/code-prefixes', { department: prefixDept.trim(), prefix: prefixValue.trim(), suffix: prefixSuffix.trim(), numberWidth: prefixNumberWidth });
      }
      setDialogOpen(false);
      setSnackbar({ open: true, message: '操作成功', severity: 'success' });
      fetchPrefixes();
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '操作失败';
      setPrefixError(message);
    }
  };

  const handleSaveCompanyName = async () => {
    try {
      await api.put('/system-info', { companyName });
      setSnackbar({ open: true, message: '企业名称已保存', severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: '保存失败', severity: 'error' });
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setSnackbar({ open: true, message: 'Logo文件不能超过2MB', severity: 'error' });
      return;
    }
    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append('logo', file);
      const res = await api.post('/system-info/logo', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setCompanyLogo(res.data.data.url);
      setSnackbar({ open: true, message: 'Logo上传成功', severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: 'Logo上传失败', severity: 'error' });
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleSaveAuditLogConfig = async () => {
    try {
      await api.put('/system-info', {
        auditLogCleanupEnabled,
        auditLogRetentionDays: auditLogRetentionDays,
      });
      setSnackbar({ open: true, message: '审计日志配置已保存', severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: '保存失败', severity: 'error' });
    }
  };

  const handleExport = async () => {
    if (!window.confirm('确定要导出当前数据库备份吗？')) return;
    setExportLoading(true);
    try {
      const res = await api.get('/backup', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `asset-manager-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.db`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setSnackbar({ open: true, message: '备份导出成功', severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: '备份导出失败', severity: 'error' });
    } finally {
      setExportLoading(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!window.confirm('恢复备份将覆盖当前所有数据，确定要继续吗？')) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setImportLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.post('/backup/restore', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setSnackbar({ open: true, message: '数据恢复成功，请刷新页面', severity: 'success' });
      setTimeout(() => { window.location.reload(); }, 2000);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '恢复失败';
      setSnackbar({ open: true, message, severity: 'error' });
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <Box>
      {/* 企业信息配置 */}
      <Card elevation={0} sx={{ border: '1px solid #e8eaed', borderRadius: 2, mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>企业信息配置</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>设置企业名称和Logo，将显示在系统侧边栏底部。</Typography>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3, flexWrap: 'wrap' }}>
            <Box sx={{ flex: 1, minWidth: 240 }}>
              <TextField
                fullWidth
                label="企业名称"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                size="small"
                sx={{ mb: 2 }}
                placeholder="如：某某有限责任公司"
              />
              <Button variant="contained" size="small" onClick={handleSaveCompanyName} sx={{ textTransform: 'none' }}>保存企业名称</Button>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              {companyLogo ? (
                <Box
                  component="img"
                  src={companyLogo}
                  alt="企业Logo"
                  sx={{ width: 80, height: 80, objectFit: 'contain', borderRadius: 1, border: '1px solid #e8eaed' }}
                />
              ) : (
                <Box sx={{ width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 1, border: '1px dashed #ccc', color: '#aaa' }}>
                  <Typography variant="body2">无Logo</Typography>
                </Box>
              )}
              <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/svg+xml,image/webp" style={{ display: 'none' }} onChange={handleLogoUpload} />
              <Button variant="outlined" size="small" startIcon={logoUploading ? <CircularProgress size={16} color="inherit" /> : <span>↑</span>} onClick={() => logoInputRef.current?.click()} disabled={logoUploading} sx={{ textTransform: 'none' }}>{logoUploading ? '上传中...' : '上传Logo'}</Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* 编号前缀配置 */}
      <Card elevation={0} sx={{ border: '1px solid #e8eaed', borderRadius: 2, mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>资产编号前缀配置</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                配置各部门的资产编号规则。编号格式：前缀 + 后缀 + 序号（如 MC-IT-2026-0001）。序号位数可在3-8之间选择，支持大批量资产。
              </Typography>
            </Box>
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={handleAddPrefix} sx={{ textTransform: 'none' }}>新增前缀</Button>
          </Box>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>部门名称</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>编号前缀</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>编号后缀</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>序号位数</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>当前序号</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>编号示例</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="center">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {prefixes.length > 0 ? (
                  prefixes.map((p) => (
                    <TableRow key={p.id} hover>
                      <TableCell>{p.department || '（通用）'}</TableCell>
                      <TableCell><Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{p.prefix}</Typography></TableCell>
                      <TableCell><Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{p.suffix || '—'}</Typography></TableCell>
                      <TableCell>{p.numberWidth || 4}</TableCell>
                      <TableCell>{p.lastSeq}</TableCell>
                      <TableCell><Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'primary.main' }}>{p.prefix}{p.suffix || ''}{String(p.lastSeq + 1).padStart(p.numberWidth || 4, '0')}</Typography></TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                          <Tooltip title="编辑"><IconButton size="small" color="primary" onClick={() => handleEditPrefix(p)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                          <Tooltip title="删除"><IconButton size="small" color="error" onClick={() => handleDeletePrefix(p.id, p.prefix)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4 }}><Typography color="text.secondary">暂无编号前缀配置</Typography></TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>{editingId ? '编辑编号规则' : '新增编号规则'}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="部门名称" value={prefixDept} onChange={(e) => setPrefixDept(e.target.value)} size="small" sx={{ mt: 1, mb: 2 }} placeholder="如：研发部（空则为通用前缀）" />
          <TextField fullWidth label="编号前缀" value={prefixValue} onChange={(e) => { setPrefixValue(e.target.value); setPrefixError(''); }} error={!!prefixError} helperText={prefixError || '只能包含字母、数字、横杠和下划线'} size="small" placeholder="如：MC-IT" sx={{ mb: 2 }} />
          <TextField fullWidth label="编号后缀" value={prefixSuffix} onChange={(e) => setPrefixSuffix(e.target.value)} size="small" placeholder="如：-2026- 或留空" helperText="后缀会插在序号前面，如前缀=MC-IT，后缀=-2026-，则编号为 MC-IT-2026-0001" sx={{ mb: 2 }} />
          <TextField fullWidth label="序号位数" type="number" value={prefixNumberWidth} onChange={(e) => setPrefixNumberWidth(Math.min(8, Math.max(3, parseInt(e.target.value) || 4)))} size="small" inputProps={{ min: 3, max: 8 }} helperText={`3-8位，${prefixNumberWidth}位最大编号数：${Math.pow(10, prefixNumberWidth) - 1}`} sx={{ mb: 1 }} />
          <Typography variant="body2" color="primary" sx={{ fontFamily: 'monospace', mt: 1 }}>
            预览：{prefixValue || 'MC'}{prefixSuffix}{String(1).padStart(prefixNumberWidth, '0')}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ textTransform: 'none' }}>取消</Button>
          <Button variant="contained" onClick={handleSubmitPrefix} sx={{ textTransform: 'none' }}>{editingId ? '保存' : '确认新增'}</Button>
        </DialogActions>
      </Dialog>

      {/* 数据备份 */}
      <Card elevation={0} sx={{ border: '1px solid #e8eaed', borderRadius: 2, mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>数据备份与恢复</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>导出当前数据库的完整备份文件，或从备份文件恢复数据。恢复操作将覆盖当前所有数据，请谨慎操作。</Typography>
          <Divider sx={{ mb: 3 }} />
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>导出备份</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>将当前系统的所有数据导出为SQLite数据库文件，可用于迁移或灾难恢复。</Typography>
            <Button variant="contained" startIcon={exportLoading ? <CircularProgress size={20} color="inherit" /> : <ExportIcon />} onClick={handleExport} disabled={exportLoading} sx={{ textTransform: 'none' }}>{exportLoading ? '导出中...' : '导出备份文件'}</Button>
          </Box>
          <Divider sx={{ mb: 3 }} />
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>恢复备份</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>从备份文件恢复数据。恢复后当前数据将被完全覆盖。</Typography>
            <Alert severity="warning" sx={{ mb: 2 }}>恢复操作不可逆，请确保已导出当前数据的备份！</Alert>
            <input ref={fileInputRef} type="file" accept=".db,.sqlite,.sqlite3" style={{ display: 'none' }} onChange={handleImport} />
            <Button variant="outlined" color="warning" startIcon={importLoading ? <CircularProgress size={20} color="inherit" /> : <ImportIcon />} onClick={() => fileInputRef.current?.click()} disabled={importLoading} sx={{ textTransform: 'none' }}>{importLoading ? '恢复中...' : '选择备份文件恢复'}</Button>
          </Box>
        </CardContent>
      </Card>

      {/* 审计日志清理配置 */}
      <Card elevation={0} sx={{ border: '1px solid #e8eaed', borderRadius: 2, mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>审计日志清理</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            开启后，系统将每天凌晨3点自动清理超过保留天数的审计日志。关闭则永久保留所有日志。
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 2, flexWrap: 'wrap' }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={auditLogCleanupEnabled}
                  onChange={(e) => setAuditLogCleanupEnabled(e.target.checked)}
                  color="primary"
                />
              }
              label="启用自动清理"
            />
            <TextField
              label="保留天数"
              type="number"
              value={auditLogRetentionDays}
              onChange={(e) => setAuditLogRetentionDays(Math.max(30, Math.min(3650, parseInt(e.target.value) || 365)))}
              size="small"
              sx={{ width: 120 }}
              inputProps={{ min: 30, max: 3650 }}
              disabled={!auditLogCleanupEnabled}
              helperText={auditLogCleanupEnabled ? `将清理 ${auditLogRetentionDays} 天前的日志` : '请先启用自动清理'}
            />
          </Box>
          <Alert severity={auditLogCleanupEnabled ? 'info' : 'warning'} sx={{ mb: 2 }}>
            {auditLogCleanupEnabled
              ? `已启用：每天凌晨3点将自动清理 ${auditLogRetentionDays} 天前的审计日志。`
              : '未启用：所有审计日志将永久保留，可能占用较多存储空间。'}
          </Alert>
          <Button variant="contained" size="small" onClick={handleSaveAuditLogConfig} sx={{ textTransform: 'none' }}>保存配置</Button>
        </CardContent>
      </Card>

      {/* 系统信息 */}
      <Card elevation={0} sx={{ border: '1px solid #e8eaed', borderRadius: 2, mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>系统信息</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 1.5 }}>
            <Typography variant="body2" color="text.secondary">系统版本</Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>6.03</Typography>
            <Typography variant="body2" color="text.secondary">后端框架</Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>Express + sql.js (SQLite)</Typography>
            <Typography variant="body2" color="text.secondary">前端框架</Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>React + TypeScript + MUI</Typography>
            <Typography variant="body2" color="text.secondary">认证方式</Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>JWT + LDAP（可配置）</Typography>
          </Box>
        </CardContent>
      </Card>

      {/* 开发者信息 */}
      <Card elevation={0} sx={{ border: '1px solid #e8eaed', borderRadius: 2 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>开发者信息</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 1.5 }}>
            <Typography variant="body2" color="text.secondary">开发者</Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>钱杰</Typography>
            <Typography variant="body2" color="text.secondary">邮箱</Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              <a href="mailto:jschinamobile@vip.qq.com" style={{ color: 'inherit', textDecoration: 'none' }}>jschinamobile@vip.qq.com</a>
            </Typography>
          </Box>
        </CardContent>
      </Card>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default SystemSettings;
