import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Popover,
  FormControlLabel,
  Divider,
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
  ViewColumn as ViewColumnIcon,
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
  const currentUser = useAuthStore((s) => s.currentUser);
  const { hasPermission, isSuperAdmin } = useAuthStore();
  /** 详情查看（含备注）仅管理员及以上；普通用户禁止点击查看按钮 */
  const canViewDetail = currentUser?.role === 'super_admin' || currentUser?.role === 'admin';
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

  /** 可配置的数据列（勾选框与操作列固定，不参与配置）；备注列仅超级管理员可见 */
  interface ColumnDef { key: string; label: string; width: number; sortable?: boolean }
  const ALL_COLUMNS: ColumnDef[] = [
    { key: 'assetCode', label: '资产编号', width: 130, sortable: true },
    { key: 'name', label: '资产名称', width: 120, sortable: true },
    { key: 'type', label: '类型', width: 75, sortable: true },
    { key: 'department', label: '部门', width: 80, sortable: true },
    { key: 'user', label: '使用人', width: 70, sortable: true },
    { key: 'status', label: '状态', width: 70, sortable: true },
    { key: 'location', label: '位置', width: 85, sortable: true },
    { key: 'wiredMacs', label: '有线MAC', width: 110, sortable: true },
    { key: 'wirelessMacs', label: '无线MAC', width: 110, sortable: true },
    { key: 'hostnames', label: '主机名', width: 90 },
    { key: 'remark', label: '备注', width: 140 },
  ];
  const COLUMN_VIEW_KEY = 'asset-table-view-v2';

  // 列视图配置状态：顺序 / 隐藏 / 宽度（按浏览器 localStorage 持久化）
  const [columnOrder, setColumnOrder] = useState<string[]>(ALL_COLUMNS.map((c) => c.key));
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [colSettingsAnchor, setColSettingsAnchor] = useState<null | HTMLElement>(null);
  const dragColRef = useRef<string | null>(null);
  const resizeRef = useRef<{ key: string; startX: number; startW: number } | null>(null);
  const viewLoadedRef = useRef<boolean>(false);

  // 从 localStorage 恢复视图配置
  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLUMN_VIEW_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved.order) && saved.order.length > 0) {
          setColumnOrder(saved.order.filter((k: string) => ALL_COLUMNS.some((c) => c.key === k)));
        }
        if (Array.isArray(saved.hidden)) setHiddenColumns(saved.hidden.filter((k: string) => ALL_COLUMNS.some((c) => c.key === k)));
        if (saved.widths && typeof saved.widths === 'object') setColumnWidths(saved.widths);
      }
    } catch { /* 忽略损坏的本地数据 */ }
    viewLoadedRef.current = true;
  }, []);

  // 视图变化时持久化（非超管强制隐藏备注列）
  useEffect(() => {
    if (!viewLoadedRef.current) return;
    const effHidden = isSuperAdmin() ? hiddenColumns : Array.from(new Set([...hiddenColumns, 'remark']));
    localStorage.setItem(COLUMN_VIEW_KEY, JSON.stringify({ order: columnOrder, hidden: effHidden, widths: columnWidths }));
  }, [columnOrder, hiddenColumns, columnWidths, isSuperAdmin]);

  // 最终渲染的可见列（顺序 + 隐藏 + 权限过滤）
  const visibleColumns = columnOrder
    .map((key) => ALL_COLUMNS.find((c) => c.key === key))
    .filter((c): c is ColumnDef => !!c)
    .filter((c) => c.key !== 'remark' || isSuperAdmin())
    .filter((c) => !hiddenColumns.includes(c.key));

  // 拖拽表头：调整列顺序
  const handleColumnReorder = (fromKey: string, toKey: string) => {
    if (fromKey === toKey) return;
    setColumnOrder((prev) => {
      const fi = prev.indexOf(fromKey);
      const ti = prev.indexOf(toKey);
      if (fi === -1 || ti === -1) return prev;
      const arr = [...prev];
      arr.splice(fi, 1);
      arr.splice(ti, 0, fromKey);
      return arr;
    });
  };

  // 表头边缘拖拽：调整列宽
  const startResize = (e: React.MouseEvent, key: string, width: number) => {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { key, startX: e.clientX, startW: width };
  };
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const st = resizeRef.current;
      if (!st) return;
      const w = Math.max(50, st.startW + e.clientX - st.startX);
      setColumnWidths((prev) => ({ ...prev, [st.key]: w }));
    };
    const onUp = () => { resizeRef.current = null; };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  const toggleColumnVisible = (key: string) => {
    setHiddenColumns((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const resetColumnView = () => {
    setColumnOrder(ALL_COLUMNS.map((c) => c.key));
    setHiddenColumns(isSuperAdmin() ? [] : ["remark"]);
    setColumnWidths({});
  };

  /** 按列 key 渲染单元格内容 */
  const renderCellContent = (key: string, asset: Asset) => {
    switch (key) {
      case 'assetCode':
        return <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{asset.assetCode}</Typography>;
      case 'name':
        return <Typography variant="body2" sx={{ fontWeight: 500 }}>{asset.name}</Typography>;
      case 'type':
        return asset.type;
      case 'department':
        return asset.department || '-';
      case 'user':
        return asset.user || '-';
      case 'status': {
        const sc = getStatusColor(asset.status);
        return <Chip label={asset.status} size="small" sx={{ bgcolor: sc.bg, color: sc.color, fontWeight: 600, fontSize: '0.75rem' }} />;
      }
      case 'location':
        return asset.location || '-';
      case 'remark':
        return asset.remark ? (
          <Tooltip title={asset.remark}>
            <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{asset.remark}</Typography>
          </Tooltip>
        ) : '-';
      case 'wiredMacs':
        return Array.isArray(asset.wiredMacs) && asset.wiredMacs.length > 0
          ? asset.wiredMacs.map((m: string, i: number) => (
              <Typography key={i} variant="caption" sx={{ display: 'block', fontFamily: 'monospace', fontSize: '0.7rem', lineHeight: 1.4 }}>{m}</Typography>
            ))
          : '-';
      case 'wirelessMacs':
        return Array.isArray(asset.wirelessMacs) && asset.wirelessMacs.length > 0
          ? asset.wirelessMacs.map((m: string, i: number) => (
              <Typography key={i} variant="caption" sx={{ display: 'block', fontFamily: 'monospace', fontSize: '0.7rem', lineHeight: 1.4 }}>{m}</Typography>
            ))
          : '-';
      case 'hostnames':
        return Array.isArray(asset.hostnames) && asset.hostnames.length > 0
          ? asset.hostnames.map((h: string, i: number) => (
              <Typography key={i} variant="caption" sx={{ display: 'block', fontSize: '0.75rem', lineHeight: 1.4 }}>{h}</Typography>
            ))
          : '-';
      default:
        return '-';
    }
  };

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
          <Button
            size="small"
            startIcon={<ViewColumnIcon />}
            onClick={(e) => setColSettingsAnchor(e.currentTarget)}
            sx={{ textTransform: 'none' }}
          >
            列设置
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
              <Table stickyHeader size="small" sx={{ tableLayout: 'fixed' }}>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" sx={{ width: 42 }}>
                      <Checkbox
                        indeterminate={selected.length > 0 && selected.length < assets.length}
                        checked={assets.length > 0 && selected.length === assets.length}
                        onChange={handleSelectAll}
                      />
                    </TableCell>
                    {visibleColumns.map((col) => (
                      <TableCell
                        key={col.key}
                        draggable
                        onDragStart={() => { dragColRef.current = col.key; }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (dragColRef.current) handleColumnReorder(dragColRef.current, col.key);
                          dragColRef.current = null;
                        }}
                        sx={{ width: columnWidths[col.key] || col.width, minWidth: 50, fontWeight: 600, position: 'relative' }}
                      >
                        {col.sortable ? (
                          <TableSortLabel
                            active={filter.sortBy === col.key}
                            direction={filter.sortBy === col.key ? filter.sortOrder : 'asc'}
                            onClick={() => handleSort(col.key)}
                          >
                            {col.label}
                          </TableSortLabel>
                        ) : (
                          <span style={{ userSelect: 'none' }}>{col.label}</span>
                        )}
                        <span
                          onMouseDown={(e) => startResize(e, col.key, columnWidths[col.key] || col.width)}
                          onClick={(e) => e.stopPropagation()}
                          title="拖动调整列宽"
                          style={{ position: 'absolute', right: 0, top: 0, height: '100%', width: 7, cursor: 'col-resize', userSelect: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <span style={{ width: 2, height: '60%', backgroundColor: '#c3c8cf', borderRadius: 1 }} />
                        </span>
                      </TableCell>
                    ))}
                    <TableCell sx={{ width: 120, fontWeight: 600 }}>操作</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {assets.length > 0 ? (
                    assets.map((asset) => {
                      const isSelected = selected.includes(asset.id);
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
                          {visibleColumns.map((col) => (
                            <TableCell key={col.key}>
                              {renderCellContent(col.key, asset)}
                            </TableCell>
                          ))}
                          <TableCell>
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                              <Tooltip title={canViewDetail ? '查看' : '无权查看详情'}>
                                <span>
                                  <IconButton size="small" onClick={() => handleView(asset)} color="primary" disabled={!canViewDetail}>
                                    <ViewIcon fontSize="small" />
                                  </IconButton>
                                </span>
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
                      <TableCell colSpan={visibleColumns.length + 2} align="center" sx={{ py: 6 }}>
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

      {/* 列设置弹窗：勾选显示列 */}
      <Popover
        open={!!colSettingsAnchor}
        anchorEl={colSettingsAnchor}
        onClose={() => setColSettingsAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ p: 1.5, minWidth: 200 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
            自定义显示列（拖动表头可调整列顺序，拖动表头右缘可调列宽）
          </Typography>
          {ALL_COLUMNS.filter((c) => c.key !== 'remark' || isSuperAdmin()).map((c) => (
            <FormControlLabel
              key={c.key}
              sx={{ display: 'flex', py: 0.25 }}
              control={
                <Checkbox
                  size="small"
                  checked={!hiddenColumns.includes(c.key)}
                  onChange={() => toggleColumnVisible(c.key)}
                />
              }
              label={<Typography variant="body2">{c.label}</Typography>}
            />
          ))}
          <Divider sx={{ my: 1 }} />
          <Button size="small" onClick={resetColumnView} sx={{ textTransform: 'none' }}>
            恢复默认
          </Button>
        </Box>
      </Popover>
    </Box>
  );
};

export default AssetTable;
