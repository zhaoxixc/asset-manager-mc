import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  Typography,
  Chip,
  Box,
  Divider,
} from '@mui/material';
import { Asset, AssetStatusItem } from '../types';
import api from '../services/api';

interface AssetDetailProps {
  open: boolean;
  asset: Asset | null;
  onClose: () => void;
}

const DetailItem: React.FC<{ label: string; value: string; span?: boolean }> = ({
  label,
  value,
  span = false,
}) => (
  <Grid item xs={span ? 12 : 6}>
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
      {label}
    </Typography>
    <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-all' }}>
      {value || '-'}
    </Typography>
  </Grid>
);

const formatList = (values?: string[]): string => {
  if (!Array.isArray(values) || values.length === 0) return '';
  return values.join('、');
};

const AssetDetail: React.FC<AssetDetailProps> = ({ open, asset, onClose }) => {
  const [assetStatuses, setAssetStatuses] = useState<AssetStatusItem[]>([]);

  useEffect(() => {
    api.get('/asset-statuses').then((res) => {
      setAssetStatuses(res.data.data || []);
    }).catch(() => { setAssetStatuses([]); });
  }, []);

  if (!asset) return null;

  const found = assetStatuses.find((s) => s.name === asset.status);
  const sc = found
    ? { bg: `${found.color}20`, color: found.color }
    : { bg: '#f5f5f5', color: '#757575' };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>资产详情</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
            {asset.name}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography
              variant="body2"
              sx={{ fontFamily: 'monospace', color: 'text.secondary' }}
            >
              {asset.assetCode}
            </Typography>
            <Chip
              label={asset.status}
              size="small"
              sx={{
                bgcolor: sc.bg,
                color: sc.color,
                fontWeight: 600,
              }}
            />
          </Box>
        </Box>
        <Divider sx={{ mb: 2 }} />

        <Grid container spacing={2}>
          <DetailItem label="资产类型" value={asset.type} />
          <DetailItem label="资产型号" value={asset.model} />
          <DetailItem label="使用部门" value={asset.department} />
          <DetailItem label="使用人" value={asset.user} />
          <DetailItem label="购入日期" value={asset.purchaseDate} />
          <DetailItem label="存放位置" value={asset.location} />
          <DetailItem label="有线MAC" value={formatList(asset.wiredMacs)} span />
          <DetailItem label="无线MAC" value={formatList(asset.wirelessMacs)} span />
          <DetailItem label="主机名" value={formatList(asset.hostnames)} span />
          <DetailItem label="备注" value={asset.remark} span />
          <DetailItem label="创建时间" value={asset.createdAt} />
          <DetailItem label="更新时间" value={asset.updatedAt} />
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>
          关闭
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AssetDetail;
