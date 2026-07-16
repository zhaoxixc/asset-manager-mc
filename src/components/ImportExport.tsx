import React, { useRef, useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Tabs,
  Tab,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  FileDownload as ExportIcon,
  FileUpload as ImportIcon,
} from '@mui/icons-material';
import useAssetStore from '../store/useAssetStore';
import useAuthStore from '../store/useAuthStore';
import { Asset, AssetFormData, AssetTypeItem, AssetStatusItem } from '../types';
import api from '../services/api';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import dayjs from 'dayjs';

/** Tab面板组件 */
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, index, value }) => (
  <Box role="tabpanel" hidden={value !== index} sx={{ pt: 2 }}>
    {value === index && children}
  </Box>
);

/** 表头映射 */
const HEADER_MAP: Record<string, keyof AssetFormData> = {
  '资产编号': 'assetCode',
  '资产名称': 'name',
  '资产类型': 'type',
  '资产型号': 'model',
  '使用部门': 'department',
  '使用人': 'user',
  '购入日期': 'purchaseDate',
  '资产状态': 'status',
  '存放位置': 'location',
  '备注': 'remark',
};

interface ImportExportProps {
  open: boolean;
  onClose: () => void;
}

/** 表单默认值 */
const DEFAULT_FORM_DATA: AssetFormData = {
  assetCode: '', name: '', type: '', model: '', department: '', user: '',
  purchaseDate: '', status: '在用', location: '', remark: '',
  wiredMacs: [], wirelessMacs: [], hostnames: [],
};

/** 导入导出组件 */
const ImportExport: React.FC<ImportExportProps> = ({ open, onClose }) => {
  const importAssets = useAssetStore((s) => s.importAssets);
  const fetchAssets = useAssetStore((s) => s.fetchAssets);
  const canImport = useAuthStore((s) => s.hasPermission('import'));

  const [allAssets, setAllAssets] = useState<Asset[]>([]);
  const [loadingExport, setLoadingExport] = useState<boolean>(false);

  // 资产类型列表（从API获取）
  const [assetTypes, setAssetTypes] = useState<AssetTypeItem[]>([]);
  // 资产状态列表（从API获取）
  const [assetStatuses, setAssetStatuses] = useState<AssetStatusItem[]>([]);

  const [tabValue, setTabValue] = useState<number>(0);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({ open: false, message: '', severity: 'info' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 获取资产类型列表
  useEffect(() => {
    if (open) {
      setLoadingExport(true);
      api.get('/assets/export').then((res) => {
        setAllAssets(res.data.data || []);
      }).catch(() => {
        setAllAssets([]);
      }).finally(() => {
        setLoadingExport(false);
      });
      api.get('/asset-types').then((res) => {
        setAssetTypes(res.data.data || []);
      }).catch(() => {
        setAssetTypes([]);
      });
      api.get('/asset-statuses').then((res) => {
        setAssetStatuses(res.data.data || []);
      }).catch(() => {
        setAssetStatuses([]);
      });
    }
  }, [open]);

  /** 导出为Excel */
  const handleExportExcel = () => {
    const exportData = allAssets.map((a) => ({
      '资产编号': a.assetCode, '资产名称': a.name, '资产类型': a.type, '资产型号': a.model,
      '使用部门': a.department, '使用人': a.user, '购入日期': a.purchaseDate,
      '资产状态': a.status, '存放位置': a.location, '备注': a.remark,
      '创建时间': a.createdAt || '', '更新时间': a.updatedAt || '',
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '资产数据');
    ws['!cols'] = [{ wch: 18 }, { wch: 20 }, { wch: 10 }, { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 8 }, { wch: 16 }, { wch: 20 }, { wch: 18 }, { wch: 18 }];
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `资产数据_${dayjs().format('YYYYMMDDHHmmss')}.xlsx`);
    showSnackbar('导出成功', 'success');
  };

  /** 导出为CSV */
  const handleExportCSV = () => {
    const headers = ['资产编号', '资产名称', '资产类型', '资产型号', '使用部门', '使用人', '购入日期', '资产状态', '存放位置', '备注'];
    const rows = allAssets.map((a) => [a.assetCode, a.name, a.type, a.model, a.department, a.user, a.purchaseDate, a.status, a.location, a.remark]);
    const escapeCsvField = (value: string): string => `"${value.replace(/"/g, '""')}"`;
    const bom = '\uFEFF';
    const csvContent = bom + [headers.join(','), ...rows.map((r) => r.map(escapeCsvField).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    saveAs(blob, `资产数据_${dayjs().format('YYYYMMDDHHmmss')}.csv`);
    showSnackbar('导出成功', 'success');
  };

  /** 处理文件导入 */
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

        if (jsonData.length === 0) {
          showSnackbar('文件中没有数据', 'error');
          return;
        }

        const assetDataList: AssetFormData[] = jsonData.map((row) => {
          const formData: AssetFormData = {
            assetCode: '', name: '', type: '', model: '', department: '', user: '',
            purchaseDate: dayjs().format('YYYY-MM-DD'), status: '在用', location: '', remark: '',
            wiredMacs: [], wirelessMacs: [], hostnames: [],
          };
          Object.entries(HEADER_MAP).forEach(([header, field]) => {
            const value = row[header] || '';
            if (field === 'type') {
              // 检查值是否在有效类型列表中
              const typeNames = assetTypes.map((t) => t.name);
              formData.type = typeNames.includes(value) ? value : (typeNames.length > 0 ? typeNames[0] : '');
            } else if (field === 'status') {
              const statusNames = assetStatuses.map((s) => s.name);
              formData.status = statusNames.includes(value) ? value : (statusNames.length > 0 ? statusNames[0] : '在用');
            } else {
              (formData as unknown as Record<string, string>)[field] = String(value);
            }
          });
          return formData;
        });

        // 调用API导入
        const result = await importAssets(assetDataList);
        if (result.fail > 0) {
          showSnackbar(`导入完成：成功 ${result.success} 条，失败 ${result.fail} 条`, 'error');
        } else {
          showSnackbar(`成功导入 ${result.success} 条资产`, 'success');
        }
        await fetchAssets();
      } catch {
        showSnackbar('文件解析失败，请检查格式', 'error');
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>数据导入/导出</DialogTitle>
        <DialogContent>
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ borderBottom: '1px solid #e8eaed', mb: 1 }}>
            <Tab label="导出数据" icon={<ExportIcon />} iconPosition="start" sx={{ textTransform: 'none' }} />
            <Tab label="导入数据" icon={<ImportIcon />} iconPosition="start" sx={{ textTransform: 'none' }} />
          </Tabs>
          <TabPanel value={tabValue} index={0}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              将当前所有资产数据导出为文件，当前共 {allAssets.length} 条记录。
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button variant="contained" startIcon={<ExportIcon />} onClick={handleExportExcel} disabled={allAssets.length === 0 || loadingExport} sx={{ textTransform: 'none' }}>{loadingExport ? '加载中...' : '导出为 Excel'}</Button>
              <Button variant="outlined" startIcon={<ExportIcon />} onClick={handleExportCSV} disabled={allAssets.length === 0 || loadingExport} sx={{ textTransform: 'none' }}>{loadingExport ? '加载中...' : '导出为 CSV'}</Button>
            </Box>
          </TabPanel>
          <TabPanel value={tabValue} index={1}>
            {canImport ? (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  从 Excel 或 CSV 文件导入资产数据。文件表头应包含：资产编号、资产名称、资产类型、资产型号、使用部门、使用人、购入日期、资产状态、存放位置、备注。
                </Typography>
                <Alert severity="info" sx={{ mb: 2 }}>
                  资产类型可选值：{assetTypes.map((t) => t.name).join('、')}；资产状态可选值：{assetStatuses.map((s) => s.name).join('、')}
                </Alert>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleImport} />
                <Button variant="contained" startIcon={<ImportIcon />} onClick={() => fileInputRef.current?.click()} sx={{ textTransform: 'none' }}>选择文件导入</Button>
              </>
            ) : (
              <Alert severity="warning">您没有导入数据的权限，请联系管理员</Alert>
            )}
          </TabPanel>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} sx={{ textTransform: 'none' }}>关闭</Button>
        </DialogActions>
      </Dialog>
      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}>{snackbar.message}</Alert>
      </Snackbar>
    </>
  );
};

export default ImportExport;
