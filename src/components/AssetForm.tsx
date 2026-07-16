import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Box,
  Grid,
  FormControlLabel,
  Checkbox,
  CircularProgress,
  Typography,
  IconButton,
  Chip,
} from '@mui/material';
import { Add as AddIcon, Close as CloseIcon } from '@mui/icons-material';
import useAssetStore from '../store/useAssetStore';
import useDeptStore from '../store/useDeptStore';
import { Asset, AssetFormData, AssetTypeItem, AssetStatusItem, CodePrefixItem } from '../types';
import api from '../services/api';
import dayjs from 'dayjs';

interface AssetFormProps {
  open: boolean;
  editingAsset: Asset | null;
  onClose: () => void;
}

const MultiValueField: React.FC<{
  label: string;
  placeholder: string;
  values: string[];
  onChange: (values: string[]) => void;
}> = ({ label, placeholder, values, onChange }) => {
  const [inputValue, setInputValue] = useState('');

  const handleAdd = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
      setInputValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleDelete = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.5 }}>
        <TextField
          size="small"
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleAdd}
          sx={{ flex: 1 }}
        />
        <IconButton size="small" onClick={handleAdd} disabled={!inputValue.trim()} color="primary">
          <AddIcon fontSize="small" />
        </IconButton>
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {values.map((v, i) => (
          <Chip
            key={i}
            label={v}
            size="small"
            onDelete={() => handleDelete(i)}
            sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
          />
        ))}
      </Box>
    </Box>
  );
};

const AssetForm: React.FC<AssetFormProps> = ({ open, editingAsset, onClose }) => {
  const addAsset = useAssetStore((s) => s.addAsset);
  const updateAsset = useAssetStore((s) => s.updateAsset);
  const departments = useDeptStore((s) => s.departments);

  const [assetTypes, setAssetTypes] = useState<AssetTypeItem[]>([]);
  const [assetStatuses, setAssetStatuses] = useState<AssetStatusItem[]>([]);
  const [codePrefixes, setCodePrefixes] = useState<CodePrefixItem[]>([]);

  const [autoGenerateCode, setAutoGenerateCode] = useState<boolean>(!editingAsset);
  const [formData, setFormData] = useState<AssetFormData>({
    assetCode: '',
    name: '',
    type: '',
    model: '',
    department: '',
    user: '',
    purchaseDate: '',
    status: '在用',
    location: '',
    remark: '',
    wiredMacs: [],
    wirelessMacs: [],
    hostnames: [],
  });

  const [errors, setErrors] = useState<Partial<Record<keyof AssetFormData, string>>>({});
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (open) {
      api.get('/asset-types').then((res) => { setAssetTypes(res.data.data || []); }).catch(() => { setAssetTypes([]); });
      api.get('/asset-statuses').then((res) => { setAssetStatuses(res.data.data || []); }).catch(() => { setAssetStatuses([]); });
      api.get('/code-prefixes').then((res) => { setCodePrefixes(res.data.data || []); }).catch(() => { setCodePrefixes([]); });
    }
  }, [open]);

  useEffect(() => {
    if (editingAsset) {
      setFormData({
        assetCode: editingAsset.assetCode,
        name: editingAsset.name,
        type: editingAsset.type,
        model: editingAsset.model,
        department: editingAsset.department,
        user: editingAsset.user,
        purchaseDate: editingAsset.purchaseDate,
        status: editingAsset.status,
        location: editingAsset.location,
        remark: editingAsset.remark,
        wiredMacs: Array.isArray(editingAsset.wiredMacs) ? editingAsset.wiredMacs : [],
        wirelessMacs: Array.isArray(editingAsset.wirelessMacs) ? editingAsset.wirelessMacs : [],
        hostnames: Array.isArray(editingAsset.hostnames) ? editingAsset.hostnames : [],
      });
      setAutoGenerateCode(false);
    } else {
      setFormData({
        assetCode: '',
        name: '',
        type: '',
        model: '',
        department: '',
        user: '',
        purchaseDate: '',
        status: assetStatuses.length > 0 ? assetStatuses[0].name : '在用',
        location: '',
        remark: '',
        wiredMacs: [],
        wirelessMacs: [],
        hostnames: [],
      });
      setAutoGenerateCode(true);
    }
    setErrors({});
  }, [editingAsset, open]);

  // 当assetStatuses异步加载完成后，更新新建表单的默认状态
  useEffect(() => {
    if (!editingAsset && assetStatuses.length > 0 && formData.status === '在用') {
      setFormData((prev) => ({ ...prev, status: assetStatuses[0].name }));
    }
  }, [assetStatuses, editingAsset]);

  // 计算当前部门对应的编号预览（仅供展示，不调用API递增计数器）
  const selectedPrefix = codePrefixes.find((p) => p.department === formData.department);
  const previewCode = autoGenerateCode && formData.department
    ? `${selectedPrefix ? selectedPrefix.prefix : 'ZC'}${selectedPrefix?.suffix || ''}${'X'.repeat(selectedPrefix?.numberWidth || 4)}`
    : '';

  const handleChange = (field: keyof AssetFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof AssetFormData, string>> = {};
    if (!autoGenerateCode && !formData.assetCode.trim()) newErrors.assetCode = '资产编号不能为空';
    if (!formData.name.trim()) newErrors.name = '资产名称不能为空';
    if (!formData.department) newErrors.department = '请选择使用部门';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    const submitData = { ...formData };
    // 自动生成模式下，清空assetCode让后端生成
    if (autoGenerateCode && !editingAsset) {
      submitData.assetCode = '';
    }
    try {
      const success = editingAsset
        ? await updateAsset(editingAsset.id, submitData)
        : await addAsset(submitData);
      if (success) onClose();
    } catch {
      // 组件层已通过全局错误拦截器显示错误，不关闭对话框
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>
        {editingAsset ? '编辑资产' : '新增资产'}
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2.5} sx={{ mt: 0 }}>
          {!editingAsset && (
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={autoGenerateCode}
                    onChange={(e) => setAutoGenerateCode(e.target.checked)}
                    color="primary"
                  />
                }
                label="自动生成编号"
              />
              {autoGenerateCode && previewCode && (
                <Typography variant="caption" color="text.secondary" sx={{ ml: 4, display: 'block' }}>
                  预计编号格式：{previewCode}（提交时自动分配序号）
                </Typography>
              )}
              {autoGenerateCode && !formData.department && (
                <Typography variant="caption" color="warning.main" sx={{ ml: 4, display: 'block' }}>
                  请先选择部门，系统将根据部门前缀自动生成编号
                </Typography>
              )}
            </Grid>
          )}
          {!autoGenerateCode || editingAsset ? (
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={editingAsset ? '资产编号（不可修改）' : '资产编号'}
                required={!editingAsset}
                value={formData.assetCode}
                onChange={(e) => handleChange('assetCode', e.target.value)}
                error={!!errors.assetCode}
                helperText={errors.assetCode}
                size="small"
                placeholder={editingAsset ? '' : '请输入资产编号'}
                disabled={!!editingAsset}
              />
            </Grid>
          ) : null}
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="资产名称"
              required
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              error={!!errors.name}
              helperText={errors.name}
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              select
              label="资产类型"
              value={formData.type}
              onChange={(e) => handleChange('type', e.target.value)}
              size="small"
            >
              {assetTypes.map((t) => (
                <MenuItem key={t.id} value={t.name}>{t.name}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="资产型号"
              value={formData.model}
              onChange={(e) => handleChange('model', e.target.value)}
              size="small"
              placeholder="选填"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              select
              label="使用部门"
              required
              value={formData.department}
              onChange={(e) => handleChange('department', e.target.value)}
              error={!!errors.department}
              helperText={errors.department}
              size="small"
            >
              {departments.map((d) => (
                <MenuItem key={d.id} value={d.name}>{d.name}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="使用人"
              value={formData.user}
              onChange={(e) => handleChange('user', e.target.value)}
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="购入日期"
              type="date"
              value={formData.purchaseDate}
              onChange={(e) => handleChange('purchaseDate', e.target.value)}
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              select
              label="资产状态"
              value={formData.status}
              onChange={(e) => handleChange('status', e.target.value)}
              size="small"
            >
              {assetStatuses.map((s) => (
                <MenuItem key={s.id} value={s.name}>{s.name}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="存放位置"
              value={formData.location}
              onChange={(e) => handleChange('location', e.target.value)}
              size="small"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="备注"
              multiline
              rows={2}
              value={formData.remark}
              onChange={(e) => handleChange('remark', e.target.value)}
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <MultiValueField
              label="有线MAC地址"
              placeholder="输入MAC地址后回车添加"
              values={formData.wiredMacs || []}
              onChange={(v) => setFormData((prev) => ({ ...prev, wiredMacs: v }))}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <MultiValueField
              label="无线MAC地址"
              placeholder="输入MAC地址后回车添加"
              values={formData.wirelessMacs || []}
              onChange={(v) => setFormData((prev) => ({ ...prev, wirelessMacs: v }))}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <MultiValueField
              label="主机名"
              placeholder="输入主机名后回车添加"
              values={formData.hostnames || []}
              onChange={(v) => setFormData((prev) => ({ ...prev, hostnames: v }))}
            />
          </Grid>
        </Grid>
        {editingAsset && (
          <Box sx={{ mt: 2, p: 1.5, bgcolor: '#f5f7fa', borderRadius: 1 }}>
            <TextField
              fullWidth
              label="资产编号"
              value={editingAsset.assetCode}
              size="small"
              InputProps={{ readOnly: true }}
              sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'white' } }}
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>取消</Button>
        <Button variant="contained" onClick={handleSubmit} sx={{ textTransform: 'none' }} disabled={submitting}>
          {submitting ? <CircularProgress size={20} /> : null}
          {editingAsset ? '保存修改' : '确认新增'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AssetForm;
