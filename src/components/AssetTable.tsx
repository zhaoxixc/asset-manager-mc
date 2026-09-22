import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  IconButton,
  Button,
  Chip,
  TextField,
  MenuItem,
  InputAdornment,
  Toolbar,
  Typography,
  Checkbox,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  FileUpload as ImportIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import useAssetStore from '../store/useAssetStore';
import useDeptStore from '../store/useDeptStore';
import useAuthStore from '../store/useAuthStore';
import { Asset, FilterCondition, defaultFilter, AssetStatusItem } from '../types';
import AssetForm from './AssetForm';
import AssetDetail from './AssetDetail';
import ImportExport from './ImportExport';
import api from '../services/api';

const PAGE_SIZE_OPTIONS = [20, 50, 100];

interface AssetTableProps {
  globalSearch: string;
  /** 从看板跳转时的预设筛选（使用人/部门/状态/全部） */
  jumpFilter?: { field: 'user' | 'department' | 'status' | 'all'; value: string; nonce: number } | null;
}

const AssetTable: React.FC<AssetTableProps> = ({ globalSearch, jumpFilter }) => {
  const assets = useAssetStore((s) => s.assets);
  const total = useAssetStore((s) => s.total);
  const departments = useDeptStore((s) => s.departments);
  const fetchAssets = useAssetStore((s) => s.fetchAssets);
  const deleteAsset = useAssetStore((s) => s.deleteAsset);
  const batchDeleteAssets = useAssetStore((s) => s.batchDeleteAssets);
  const loading = useAssetStore((s) => s.loading);
  const { hasPermission } = useAuthStore();
  const canCreate = hasPermission('create');
  const canEdit = hasPermission('edit');
  const canDelete = hasPermission('delete');
  const canImport = hasPermission('import');

  const [assetStatuses, setAssetStatuses] = useState<AssetStatusItem[]>([]);
  const [assetTypes, setAssetTypes] = useState<{ id: string; name: string }[]>([]);
  const [allLocations, setAllLocations] = useState<string[]>([]);

  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(20);
  const [pageJump, setPageJump] = useState<string>('');

  const [filter, setFilter] = useState<FilterCondition>({
    ...defaultFilter,
    keyword: globalSearch,
  });
  const [showFilter, setShowFilter] = useState<boolean>(false);

  const [selected, setSelected] = useState<string[]>([]);

  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [detailOpen, setDetailOpen] = useState<boolean>(false);
  const [viewingAsset, setViewingAsset] = useState<Asset | null>(null);
  const [importExportOpen, setImportExportOpen] = useState<boolean>(false);

  const [searchKeyword, setSearchKeyword] = useState<string>(filter.keyword || '');

  useEffect(() => {
    setSearchKeyword(filter.keyword || '');
  }, [filter.keyword]);

  const debouncedFetch = useCallback(
    (f: FilterCondition, p: number, ps: number) => {
      const timer = setTimeout(() => {
        fetchAssets(f, p + 1, ps);
      }, 300);
      return () => clearTimeout(timer);
    },
    [fetchAssets],
  );

  const fetchAllLocations = useCallback(async () => {
    try {
      const res = await api.get('/assets/export');
      const allAssets = (res.data.data || []) as Asset[];
      const locations = [...new Set(allAssets.map((a) => a.location).filter(Boolean))];
      locations.sort();
      setAllLocations(locations);
    } catch {
      setAllLocations([]);
    }
  }, []);

  useEffect(() => {
    const cleanup = debouncedFetch(filter, page, rowsPerPage);
    return cleanup;
  }, [filter, page, rowsPerPage, debouncedFetch]);

  useEffect(() => {
    fetchAllLocations();
  }, [fetchAllLocations]);

  useEffect(() => {
    api.get('/asset-types').then((res) => {
      setAssetTypes(res.data.data || []);
    }).catch(() => { setAssetTypes([]); });
  }, []);

  useEffect(() => {
    api.get('/asset-statuses').then((res) => {
      setAssetStatuses(res.data.data || []);
    }).catch(() => { setAssetStatuses([]); });
  }, []);

  useEffect(() => {
    if (globalSearch !== filter.keyword) {
      setFilter((prev) => ({ ...prev, keyword: globalSearch }));
      setPage(0);
    }
  }, [globalSearch]);

  // 应用从看板跳转带来的筛选（使用人/部门/状态精确匹配，all=查看全部并清空筛选）
  useEffect(() => {
    if (jumpFilter) {
      if (jumpFilter.field === 'user') {
        setFilter((prev) => ({ ...prev, keyword: '', user: jumpFilter.value }));
        setSearchKeyword('');
      } else if (jumpFilter.field === 'department') {
        setFilter((prev) => ({ ...prev, keyword: '', user: '', department: jumpFilter.value }));
      } else if (jumpFilter.field === 'status') {
        setFilter((prev) => ({ ...prev, keyword: '', user: '', status: jumpFilter.value }));
      } else {
        setFilter((prev) => ({ ...defaultFilter, sortBy: prev.sortBy, sortOrder: prev.sortOrder }));
        setSearchKeyword('');
      }
      setPage(0);
    }
  }, [jumpFilter?.nonce]);

  const getStatusColor = (status: string): { bg: string; color: string } => {
    const found = assetStatuses.find((s) => s.name === status);
    if (found) return { bg: `${found.color}20`, color: found.color };
    const fallback: Record<string, { bg: string; color: string }> = {
      '在用': { bg: '#e6f4ea', color: '#34a853' },
      '闲置': { bg: '#fef3e2', color: '#ff6d00' },
      '维修': { bg: '#f3e8fd', color: '#9334e6' },
      '损坏': { bg: '#fce8e6', color: '#ea4335' },
      '报废': { bg: '#f5f5f5', color: '#9e9e9e' },
    };
    return fallback[status] || { bg: '#f5f5f5', color: '#757575' };
  };

  const handleSort = (columnId: string) => {
    setFilter((prev) => ({
      ...prev,
      sortBy: columnId,
      sortOrder: prev.sortBy === columnId && prev.sortOrder === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleSelectAll = () => {
    if (selected.length === assets.length) {
      setSelected([]);
    } else {
      setSelected(assets.map((a) => a.id));
    }
  };

  const handleSelectRow = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const handleBatchDelete = async () => {
    if (selected.length === 0) return;
    if (window.confirm(`确定要删除选中的 ${selected.length} 条资产吗？`)) {
      await batchDeleteAssets(selected);
      setSelected([]);
    }
  };

  const handleAdd = () => {
    setEditingAsset(null);
    setFormOpen(true);
  };

  const handleEdit = (asset: Asset) => {
    setEditingAsset(asset);
    setFormOpen(true);
  };

  const handleView = (asset: Asset) => {
    setViewingAsset(asset);
    setDetailOpen(true);
  };

  const handleDelete = async (asset: Asset) => {
    if (window.confirm(`确定要删除资产"${asset.name}"吗？`)) {
      await deleteAsset(asset.id);
    }
  };

  const handleRefresh = () => {
    fetchAssets(filter, page + 1, rowsPerPage);
    fetchAllLocations();
  };

  const columns = [
    { id: 'assetCode', label: '资产编号', minWidth: 130, sortable: true },
    { id: 'name', label: '资产名称', minWidth: 120, sortable: true },
    { id: 'type', label: '类型', minWidth: 75 },
    { id: 'department', label: '部门', minWidth: 80 },
    { id: 'user', label: '使用人', minWidth: 65 },
    { id: 'status', label: '状态', minWidth: 65 },
    { id: 'location', label: '位置', minWidth: 85 },
    { id: 'wiredMacs', label: '有线MAC', minWidth: 110 },
    { id: 'wirelessMacs', label: '无线MAC', minWidth: 110 },
    { id: 'hostnames', label: '主机名', minWidth: 90 },
    { id: 'actions', label: '操作', minWidth: 120 },
  ];

  return (
    <Box>
      <Card elevation={0} sx={{ border: '1px solid #e8eaed', borderRadius: 2, mb: 2 }}>
        <Toolbar sx={{ px: 2, gap: 1.5, flexWrap: 'wrap' }}>
          <TextField
            size="small"
            placeholder="搜索名称、编号、使用人、MAC、主机名..."
            value={searchKeyword}
            onChange={(e) => {
              const kw = e.target.value;
              setSearchKeyword(kw);
              setFilter((prev) => ({ ...prev, keyword: kw }));
              setPage(0);
            }}
            sx={{ width: 280 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                </InputAdornment>
              ),
            }}
          />
          {filter.user && (
            <Chip
              label={`使用人: ${filter.user}`}
              size="small"
              onDelete={() => { setFilter((prev) => ({ ...prev, user: '' })); setPage(0); }}
              sx={{ bgcolor: '#e8f0fe', color: '#1a73e8', fontWeight: 600 }}
            />
          )}
          {filter.department && (
            <Chip
              label={`部门: ${filter.department}`}
              size="small"
              onDelete={() => { setFilter((prev) => ({ ...prev, department: '' })); setPage(0); }}
              sx={{ bgcolor: '#e6f4ea', color: '#34a853', fontWeight: 600 }}
            />
          )}
          {filter.status && (
            <Chip
              label={`状态: ${filter.status}`}
              size="small"
              onDelete={() => { setFilter((prev) => ({ ...prev, status: '' })); setPage(0); }}
              sx={{ bgcolor: '#fef3e2', color: '#ff6d00', fontWeight: 600 }}
            />
          )}
          <Button
            size="small"
            startIcon={<FilterIcon />}
            onClick={() => setShowFilter(!showFilter)}
            variant={showFilter ? 'contained' : 'outlined'}
            sx={{ textTransform: 'none' }}
          >
            筛选
          </Button>
          <IconButton size="small" onClick={handleRefresh} title="刷新">
            <RefreshIcon fontSize="small" />
          </IconButton>

          <Box sx={{ flex: 1 }} />

          {selected.length > 0 && canDelete && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 1 }}>
              <Typography variant="body2" color="text.secondary">
                已选 {selected.length} 项
              </Typography>
              <Button
                size="small"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={handleBatchDelete}
              >
                批量删除
              </Button>
            </Box>
          )}

          <Tooltip title={!canImport ? '您没有操作权限' : ''}>
            <span>
              <Button
                size="small"
                startIcon={<ImportIcon />}
                onClick={() => setImportExportOpen(true)}
                disabled={!canImport}
                sx={{ textTransform: 'none' }}
              >
                导入/导出
              </Button>
            </span>
          </Tooltip>
          <Tooltip title={!canCreate ? '您没有操作权限' : ''}>
            <span>
              <Button
                variant="contained"
                size="small"
                startIcon={<AddIcon />}
                onClick={handleAdd}
                disabled={!canCreate}
                sx={{ textTransform: 'none' }}
              >
                新增资产
              </Button>
            </span>
          </Tooltip>
        </Toolbar>

        {showFilter && (
          <Box sx={{ px: 2, pb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              select
              size="small"
              label="资产类型"
              value={filter.type}
              onChange={(e) => { setFilter((prev) => ({ ...prev, type: e.target.value })); setPage(0); }}
              sx={{ minWidth: 130 }}
            >
              <MenuItem value="">全部</MenuItem>
              {assetTypes.map((t) => (
                <MenuItem key={t.id} value={t.name}>{t.name}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="部门"
              value={filter.department}
              onChange={(e) => { setFilter((prev) => ({ ...prev, department: e.target.value })); setPage(0); }}
              sx={{ minWidth: 130 }}
            >
              <MenuItem value="">全部</MenuItem>
              {departments.map((d) => (
                <MenuItem key={d.id} value={d.name}>{d.name}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="状态"
              value={filter.status}
              onChange={(e) => { setFilter((prev) => ({ ...prev, status: e.target.value })); setPage(0); }}
              sx={{ minWidth: 130 }}
            >
              <MenuItem value="">全部</MenuItem>
              {assetStatuses.map((s) => (
                <MenuItem key={s.id} value={s.name}>{s.name}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="位置"
              value={filter.location}
              onChange={(e) => { setFilter((prev) => ({ ...prev, location: e.target.value })); setPage(0); }}
              sx={{ minWidth: 130 }}
            >
              <MenuItem value="">全部</MenuItem>
              {allLocations.map((loc) => (
                <MenuItem key={loc} value={loc}>{loc}</MenuItem>
              ))}
            </TextField>
            <Button
              size="small"
              onClick={() => { setFilter({ ...defaultFilter }); setPage(0); }}
              sx={{ textTransform: 'none' }}
            >
              重置
            </Button>
          </Box>
        )}
      </Card>

      <Card elevation={0} sx={{ border: '1px solid #e8eaed', borderRadius: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        indeterminate={selected.length > 0 && selected.length < assets.length}
                        checked={assets.length > 0 && selected.length === assets.length}
                        onChange={handleSelectAll}
                      />
                    </TableCell>
                    {columns.map((col) => (
                      <TableCell
                        key={col.id}
                        sx={{ minWidth: col.minWidth, fontWeight: 600 }}
                      >
                        {col.sortable ? (
                          <TableSortLabel
                            active={filter.sortBy === col.id}
                            direction={filter.sortBy === col.id ? filter.sortOrder : 'asc'}
                            onClick={() => handleSort(col.id)}
                          >
                            {col.label}
                          </TableSortLabel>
                        ) : (
                          col.label
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {assets.length > 0 ? (
                    assets.map((asset) => {
                      const isSelected = selected.includes(asset.id);
                      const sc = getStatusColor(asset.status);
                      return (
                        <TableRow
                          key={asset.id}
                          hover
                          selected={isSelected}
                          sx={{ '&:last-child td': { border: 0 } }}
                        >
                          <TableCell padding="checkbox">
                            <Checkbox
                              checked={isSelected}
                              onChange={() => handleSelectRow(asset.id)}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                              {asset.assetCode}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {asset.name}
                            </Typography>
                          </TableCell>
                          <TableCell>{asset.type}</TableCell>
                          <TableCell>{asset.department || '-'}</TableCell>
                          <TableCell>{asset.user || '-'}</TableCell>
                          <TableCell>
                            <Chip
                              label={asset.status}
                              size="small"
                              sx={{
                                bgcolor: sc.bg,
                                color: sc.color,
                                fontWeight: 600,
                                fontSize: '0.75rem',
                              }}
                            />
                          </TableCell>
                          <TableCell>{asset.location || '-'}</TableCell>
                          <TableCell>
                            {Array.isArray(asset.wiredMacs) && asset.wiredMacs.length > 0
                              ? asset.wiredMacs.map((m: string, i: number) => (
                                  <Typography key={i} variant="caption" sx={{ display: 'block', fontFamily: 'monospace', fontSize: '0.7rem', lineHeight: 1.4 }}>{m}</Typography>
                                ))
                              : '-'}
                          </TableCell>
                          <TableCell>
                            {Array.isArray(asset.wirelessMacs) && asset.wirelessMacs.length > 0
                              ? asset.wirelessMacs.map((m: string, i: number) => (
                                  <Typography key={i} variant="caption" sx={{ display: 'block', fontFamily: 'monospace', fontSize: '0.7rem', lineHeight: 1.4 }}>{m}</Typography>
                                ))
                              : '-'}
                          </TableCell>
                          <TableCell>
                            {Array.isArray(asset.hostnames) && asset.hostnames.length > 0
                              ? asset.hostnames.map((h: string, i: number) => (
                                  <Typography key={i} variant="caption" sx={{ display: 'block', fontSize: '0.75rem', lineHeight: 1.4 }}>{h}</Typography>
                                ))
                              : '-'}
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                              <Tooltip title="查看">
                                <IconButton size="small" onClick={() => handleView(asset)} color="primary">
                                  <ViewIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title={!canEdit ? '您没有操作权限' : '编辑'}>
                                <span>
                                  <IconButton size="small" onClick={() => handleEdit(asset)} color="primary" disabled={!canEdit}>
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                              <Tooltip title={!canDelete ? '您没有操作权限' : '删除'}>
                                <span>
                                  <IconButton size="small" onClick={() => handleDelete(asset)} color="error" disabled={!canDelete}>
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
                    <TableRow>
                      <TableCell colSpan={columns.length + 1} align="center" sx={{ py: 6 }}>
                        <Typography color="text.secondary">暂无资产数据</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1, flexWrap: 'wrap' }}>
              <TablePagination
                component="div"
                count={total}
                page={page}
                rowsPerPage={rowsPerPage}
                onPageChange={(_, newPage) => { setPage(newPage); setSelected([]); setPageJump(''); }}
                onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); setSelected([]); setPageJump(''); }}
                rowsPerPageOptions={PAGE_SIZE_OPTIONS}
                labelRowsPerPage="每页行数："
                labelDisplayedRows={({ from, to, count }) =>
                  `${from}-${to} / 共 ${count} 条`
                }
                sx={{ borderBottom: 'none' }}
              />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 1 }}>
                <Typography variant="body2" color="text.secondary">跳至</Typography>
                <TextField
                  size="small"
                  value={pageJump}
                  onChange={(e) => setPageJump(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const targetPage = parseInt(pageJump, 10) - 1;
                      const maxPage = Math.max(0, Math.ceil(total / rowsPerPage) - 1);
                      if (!isNaN(targetPage) && targetPage >= 0 && targetPage <= maxPage) {
                        setPage(targetPage);
                        setSelected([]);
                      } else if (pageJump) {
                        window.dispatchEvent(new CustomEvent('api-error', { detail: `请输入 1 - ${maxPage + 1} 之间的页码` }));
                      }
                      setPageJump('');
                    }
                  }}
                  sx={{ width: 60 }}
                  inputProps={{ style: { textAlign: 'center', padding: '4px 8px' } }}
                />
                <Typography variant="body2" color="text.secondary">页</Typography>
              </Box>
            </Box>
          </>
        )}
      </Card>

      <AssetForm
        open={formOpen}
        editingAsset={editingAsset}
        onClose={() => {
          setFormOpen(false);
          setEditingAsset(null);
          fetchAllLocations();
        }}
      />

      <AssetDetail
        open={detailOpen}
        asset={viewingAsset}
        onClose={() => {
          setDetailOpen(false);
          setViewingAsset(null);
        }}
      />

      <ImportExport
        open={importExportOpen}
        onClose={() => setImportExportOpen(false)}
      />
    </Box>
  );
};

export default AssetTable;
