import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  List,
  ListItem,
  ListItemText,
  Avatar,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  InputAdornment,
  Tooltip as MuiTooltip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  Autocomplete,
} from '@mui/material';
import {
  Inventory2 as AssetIcon,
  CheckCircle as InUseIcon,
  PauseCircle as IdleIcon,
  Build as RepairIcon,
  Delete as ScrapIcon,
  Warning as DamagedIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import api from '../services/api';
import useAuthStore from '../store/useAuthStore';
import PaginationFooter from './PaginationFooter';
import { DashboardStats, ChangeLog } from '../types';

/** 排行榜单次拉取上限（前端分页展示） */
const RANKING_FETCH_LIMIT = 1000;
const RANKING_PAGE_SIZE = 20;
/** 状态卡片折叠阈值：超过该数量时默认折叠 */
const STATUS_COLLAPSE_COUNT = 8;

const PIE_COLORS = ['#1a73e8', '#ff6d00', '#34a853', '#9334e6', '#ea4335', '#00bcd4', '#795548', '#607d8b'];

/** 常用状态的图标映射（未匹配到的状态使用通用图标） */
const STATUS_ICON_MAP: Record<string, React.ReactNode> = {
  '在用': <InUseIcon />,
  '闲置': <IdleIcon />,
  '维修中': <RepairIcon />,
  '维修': <RepairIcon />,
  '损坏': <DamagedIcon />,
  '报废': <ScrapIcon />,
};

interface DashboardProps {
  globalSearch: string;
  /** 点击排行/统计卡片时跳转资产列表（field: user=使用人, department=部门, status=状态, all=全部） */
  onNavigateToAssets?: (field: 'user' | 'department' | 'status' | 'all', value: string) => void;
}

/** 使用人设备排行项（仅关联资产"使用人"字段） */
interface UserRankingItem {
  userName: string;
  count: number;
  types: string[];
  matched?: boolean;
  hasEmail?: boolean;
  emailMasked?: string;
  /** 完整邮箱仅管理员及以上返回 */
  email?: string;
}

/** 提醒预览数据 */
interface ReminderPreview {
  userName: string;
  matched: boolean;
  matchedBy: string;
  username: string;
  email: string;
  smtpConfigured: boolean;
  assets: { assetCode: string; name: string; type: string }[];
  lastReminder: { time: string; assetCount: number } | null;
}

const RANK_COLORS = ['#f9ab00', '#9aa0a6', '#b06000'];

const Dashboard: React.FC<DashboardProps> = ({ globalSearch, onNavigateToAssets }) => {
  const currentUser = useAuthStore((s) => s.currentUser);
  const canSendReminder = currentUser?.role === 'super_admin' || currentUser?.role === 'admin';
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [ranking, setRanking] = useState<UserRankingItem[]>([]);
  const [rankingInput, setRankingInput] = useState<string>('');
  const [rankingKeyword, setRankingKeyword] = useState<string>('');
  const [reminderOpen, setReminderOpen] = useState<boolean>(false);
  const [reminderLoading, setReminderLoading] = useState<boolean>(false);
  const [reminderPreview, setReminderPreview] = useState<ReminderPreview | null>(null);
  const [reminderSending, setReminderSending] = useState<boolean>(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });
  const [rankPage, setRankPage] = useState<number>(0);
  const [rankRowsPerPage, setRankRowsPerPage] = useState<number>(RANKING_PAGE_SIZE);
  const [changeLogs, setChangeLogs] = useState<ChangeLog[]>([]);
  const [logTotal, setLogTotal] = useState<number>(0);
  const [logPage, setLogPage] = useState<number>(0);
  const [logRowsPerPage, setLogRowsPerPage] = useState<number>(10);
  const [showAllStatusCards, setShowAllStatusCards] = useState<boolean>(false);
  const [associateOpen, setAssociateOpen] = useState<boolean>(false);
  const [associateTarget, setAssociateTarget] = useState<UserRankingItem | null>(null);
  const [associateUser, setAssociateUser] = useState<{ username: string; displayName: string } | null>(null);
  const [userOptions, setUserOptions] = useState<{ username: string; displayName: string }[]>([]);
  const [associateSubmitting, setAssociateSubmitting] = useState<boolean>(false);

  // 响应顶栏全局搜索
  useEffect(() => {
    setRankingInput(globalSearch);
    setRankingKeyword(globalSearch);
  }, [globalSearch]);

  // 打开提醒预览弹窗
  const openReminder = async (userName: string) => {
    setReminderOpen(true);
    setReminderLoading(true);
    setReminderPreview(null);
    try {
      const res = await api.get('/dashboard/reminder-preview', { params: { userName } });
      setReminderPreview(res.data.data);
    } catch {
      setReminderOpen(false);
      setSnackbar({ open: true, message: '获取预览失败', severity: 'error' });
    } finally {
      setReminderLoading(false);
    }
  };

  // 发送提醒邮件
  const handleSendReminder = async () => {
    if (!reminderPreview) return;
    setReminderSending(true);
    try {
      const res = await api.post('/dashboard/send-reminder', { userName: reminderPreview.userName });
      setSnackbar({ open: true, message: res.data.message || '发送成功', severity: 'success' });
      setReminderOpen(false);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '发送失败';
      setSnackbar({ open: true, message, severity: 'error' });
    } finally {
      setReminderSending(false);
    }
  };

  // 打开关联弹窗
  const openAssociate = (item: UserRankingItem) => {
    setAssociateTarget(item);
    setAssociateUser(null);
    setAssociateOpen(true);
    api.get('/users/options').then((res) => setUserOptions(res.data.data || [])).catch(() => setUserOptions([]));
  };

  // 提交关联
  const handleAssociate = async () => {
    if (!associateTarget || !associateUser) return;
    setAssociateSubmitting(true);
    try {
      const res = await api.post('/dashboard/associate', { userName: associateTarget.userName, username: associateUser.username });
      setSnackbar({ open: true, message: res.data.message || '关联成功', severity: 'success' });
      setAssociateOpen(false);
      fetchRanking();
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '关联失败';
      setSnackbar({ open: true, message, severity: 'error' });
    } finally {
      setAssociateSubmitting(false);
    }
  };

  // 排行榜搜索（防抖，拉取全量后前端分页）
  const fetchRanking = useCallback(() => {
    api.get('/dashboard/user-ranking', { params: { keyword: rankingKeyword, limit: RANKING_FETCH_LIMIT } })
      .then((res) => setRanking(res.data.data || []))
      .catch(() => {});
  }, [rankingKeyword]);

  useEffect(() => {
    const timer = setTimeout(fetchRanking, 400);
    return () => clearTimeout(timer);
  }, [fetchRanking]);

  // 排行榜分页
  const rankSafePage = Math.min(rankPage, Math.max(0, Math.ceil(ranking.length / rankRowsPerPage) - 1));
  const pagedRanking = ranking.slice(rankSafePage * rankRowsPerPage, rankSafePage * rankRowsPerPage + rankRowsPerPage);

  // 近期变动记录（服务端分页）
  const logSafePage = Math.min(logPage, Math.max(0, Math.ceil(logTotal / logRowsPerPage) - 1));
  useEffect(() => {
    api.get('/change-logs', { params: { page: logSafePage + 1, pageSize: logRowsPerPage } })
      .then((res) => {
        setChangeLogs(res.data.data.items || []);
        setLogTotal(res.data.data.total || 0);
      })
      .catch(() => {});
  }, [logSafePage, logRowsPerPage]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/dashboard/stats');
        setStats(res.data.data);
      } catch {
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!stats) {
    return <Typography color="text.secondary">无法加载看板数据</Typography>;
  }

  // 状态卡片动态生成：总数卡片 + 状态管理中定义的每个状态（新增状态自动出现，均可点击跳转）
  // 状态较多时默认只显示前 8 个，可展开全部（排序跟随状态管理的自定义排序）
  const visibleStatusCounts = showAllStatusCards
    ? stats.statusCounts
    : stats.statusCounts.slice(0, STATUS_COLLAPSE_COUNT);
  const statCards = [
    { key: '__total__', label: '资产总数', value: stats.totalAssets, icon: <AssetIcon />, color: '#1a73e8', bgColor: '#e8f0fe', jump: { field: 'all' as const, value: '' } },
    ...visibleStatusCounts.map((s) => ({
      key: `status-${s.name}`,
      label: s.name,
      value: s.count,
      icon: STATUS_ICON_MAP[s.name] || <AssetIcon />,
      color: s.color,
      bgColor: `${s.color}20`,
      jump: { field: 'status' as const, value: s.name },
    })),
  ];

  const getStatusColor = (status: string): string => {
    if (stats.statusCounts) {
      const found = stats.statusCounts.find((s) => s.name === status);
      if (found) return found.color;
    }
    switch (status) {
      case '新增': return '#34a853';
      case '编辑': return '#1a73e8';
      case '状态变更': return '#ff6d00';
      case '删除': return '#ea4335';
      default: return '#757575';
    }
  };

  const renderPieLabel = ({ name, percent }: { name: string; percent: number }) => {
    if (percent < 0.05) return null;
    return `${name} ${(percent * 100).toFixed(0)}%`;
  };

  const renderLabelLine = (props: Record<string, unknown>) => {
    const percent = props.percent as number;
    if (percent < 0.05) return <line />;
    const { points } = props as { points: Array<{ x: number; y: number }> };
    if (!points || points.length < 2) return <line />;
    const [start, end] = points;
    return (
      <line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke="#999"
        strokeWidth={1}
      />
    );
  };

  return (
    <Box>
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {statCards.map((card) => (
          <Grid item xs={12} sm={6} md key={card.label}>
            <MuiTooltip title={card.jump ? `点击查看${card.label === '资产总数' ? '全部' : ''}资产` : ''}>
              <Card
                elevation={0}
                onClick={card.jump ? () => onNavigateToAssets?.(card.jump!.field, card.jump!.value) : undefined}
                sx={{
                  border: '1px solid #e8eaed',
                  borderRadius: 2,
                  height: '100%',
                  ...(card.jump ? { cursor: 'pointer', transition: 'all 0.2s', '&:hover': { boxShadow: '0 2px 12px rgba(0,0,0,0.12)', transform: 'translateY(-2px)' } } : {}),
                }}
              >
                <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                        {card.label}
                      </Typography>
                      <Typography variant="h4" sx={{ fontWeight: 700, color: card.color }}>
                        {card.value}
                      </Typography>
                    </Box>
                    <Avatar
                      sx={{
                        bgcolor: card.bgColor,
                        color: card.color,
                        width: 48,
                        height: 48,
                      }}
                    >
                      {card.icon}
                    </Avatar>
                  </Box>
                </CardContent>
              </Card>
            </MuiTooltip>
          </Grid>
        ))}
        {stats.statusCounts.length > STATUS_COLLAPSE_COUNT && (
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Button size="small" onClick={() => setShowAllStatusCards(!showAllStatusCards)} sx={{ textTransform: 'none' }}>
                {showAllStatusCards ? '收起状态' : `展开全部 ${stats.statusCounts.length} 个状态`}
              </Button>
            </Box>
          </Grid>
        )}
      </Grid>

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} md={5}>
          <Card elevation={0} sx={{ border: '1px solid #e8eaed', borderRadius: 2, height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                资产类型分布
              </Typography>
              {stats.typeDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={stats.typeDistribution}
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      innerRadius={40}
                      dataKey="value"
                      label={renderPieLabel}
                      labelLine={renderLabelLine}
                      minAngle={5}
                    >
                      {stats.typeDistribution.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Box sx={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography color="text.secondary">暂无数据</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={7}>
          <Card elevation={0} sx={{ border: '1px solid #e8eaed', borderRadius: 2, height: '100%' }}>
            <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 2, gap: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                部门资产分布
              </Typography>
              <Typography variant="caption" color="text.secondary">
                点击柱条可查看该部门资产
              </Typography>
            </Box>
              {stats.departmentDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={stats.departmentDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis allowDecimals={false} fontSize={12} />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="count"
                      name="资产数量"
                      fill="#1a73e8"
                      radius={[4, 4, 0, 0]}
                      cursor="pointer"
                      onClick={(data: { payload?: { name?: string } }) => {
                        const dept = data?.payload?.name;
                        if (dept && dept !== '未分配') onNavigateToAssets?.('department', dept);
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Box sx={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography color="text.secondary">暂无数据</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card elevation={0} sx={{ border: '1px solid #e8eaed', borderRadius: 2, mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              使用人设备数量排行
            </Typography>
            <TextField
              size="small"
              placeholder="搜索/筛选使用人"
              value={rankingInput}
              onChange={(e) => { setRankingInput(e.target.value); setRankingKeyword(e.target.value); }}
              InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>) }}
              sx={{ width: 220 }}
            />
          </Box>
          {ranking.length > 0 ? (
            <>
              <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, width: 70 }} align="center">排名</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>使用人</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>邮箱</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="center">设备数量</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>设备类型</TableCell>
                  {canSendReminder && <TableCell sx={{ fontWeight: 600 }} align="center">操作</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {pagedRanking.map((item, index) => (
                  <TableRow key={item.userName} hover>
                    <TableCell align="center">
                      <Chip
                        label={rankSafePage * rankRowsPerPage + index + 1}
                        size="small"
                        sx={{
                          minWidth: 34,
                          height: 26,
                          px: 0.5,
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          bgcolor: rankSafePage === 0 && index < 3 ? RANK_COLORS[index] : '#f1f3f4',
                          color: rankSafePage === 0 && index < 3 ? '#fff' : '#5f6368',
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        onClick={() => onNavigateToAssets?.('user', item.userName)}
                        sx={{ fontWeight: 500, cursor: 'pointer', '&:hover': { color: '#1a73e8', textDecoration: 'underline' } }}
                      >
                        {item.userName}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {item.email || item.emailMasked ? (
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>{item.email || item.emailMasked}</Typography>
                      ) : (
                        <Typography variant="body2" sx={{ color: 'text.disabled' }}>-</Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <MuiTooltip title="点击查看该使用人名下的设备">
                        <Typography
                          variant="body2"
                          onClick={() => onNavigateToAssets?.('user', item.userName)}
                          sx={{ fontWeight: 700, color: '#1a73e8', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                        >
                          {item.count}
                        </Typography>
                      </MuiTooltip>
                    </TableCell>
                    <TableCell>{item.types.join('、')}</TableCell>
                    {canSendReminder && (
                      <TableCell align="center">
                        {item.matched && item.hasEmail ? (
                          <MuiTooltip title={`发送至 ${item.emailMasked}`}>
                            <Button size="small" variant="outlined" onClick={() => openReminder(item.userName)} sx={{ textTransform: 'none' }}>
                              发送提醒
                            </Button>
                          </MuiTooltip>
                        ) : item.matched ? (
                          <MuiTooltip title="该用户未填写邮箱，请到用户管理补全">
                            <span><Button size="small" variant="outlined" disabled sx={{ textTransform: 'none' }}>无邮箱</Button></span>
                          </MuiTooltip>
                        ) : (
                          <MuiTooltip title="选择对应的登录用户进行关联">
                            <Button size="small" variant="outlined" color="warning" onClick={() => openAssociate(item)} sx={{ textTransform: 'none' }}>
                              关联
                            </Button>
                          </MuiTooltip>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PaginationFooter
              count={ranking.length}
              page={rankSafePage}
              rowsPerPage={rankRowsPerPage}
              onPageChange={setRankPage}
              onRowsPerPageChange={(n) => { setRankRowsPerPage(n); setRankPage(0); }}
              onJumpError={(m) => setSnackbar({ open: true, message: m, severity: 'error' })}
            />
            </>
          ) : (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">{rankingKeyword ? '未找到匹配的使用人' : '暂无数据'}</Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      <Card elevation={0} sx={{ border: '1px solid #e8eaed', borderRadius: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
            近期变动记录
          </Typography>
          {changeLogs.length > 0 ? (
            <>
            <List dense>
              {changeLogs.map((log) => (
                <ListItem
                  key={log.id}
                  sx={{
                    px: 1,
                    py: 1,
                    borderRadius: 1,
                    '&:hover': { bgcolor: '#f5f7fa' },
                  }}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label={log.action}
                          size="small"
                          sx={{
                            bgcolor: `${getStatusColor(log.action)}15`,
                            color: getStatusColor(log.action),
                            fontWeight: 600,
                            fontSize: '0.75rem',
                          }}
                        />
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {log.assetName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          ({log.assetCode})
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        {log.detail} · {log.createdAt}
                      </Typography>
                    }
                  />
                </ListItem>
              ))}
            </List>
            <PaginationFooter
              count={logTotal}
              page={logSafePage}
              rowsPerPage={logRowsPerPage}
              onPageChange={setLogPage}
              onRowsPerPageChange={(n) => { setLogRowsPerPage(n); setLogPage(0); }}
              rowsPerPageOptions={[10, 20, 50]}
              onJumpError={(m) => setSnackbar({ open: true, message: m, severity: 'error' })}
            />
            </>
          ) : (
            <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
              暂无变动记录
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* 发送提醒确认弹窗 */}
      <Dialog open={reminderOpen} onClose={() => !reminderSending && setReminderOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>发送设备数量提醒</DialogTitle>
        <DialogContent dividers>
          {reminderLoading || !reminderPreview ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
          ) : (
            <>
              {!reminderPreview.smtpConfigured && (
                <Alert severity="warning" sx={{ mb: 2 }}>SMTP邮件服务未配置或未启用，请先到「系统设置 → 邮件通知」完成配置</Alert>
              )}
              {!reminderPreview.matched && (
                <Alert severity="warning" sx={{ mb: 2 }}>该使用人未能关联到登录用户，无法发送</Alert>
              )}
              {reminderPreview.matched && !reminderPreview.email && (
                <Alert severity="warning" sx={{ mb: 2 }}>关联用户「{reminderPreview.username}」未填写邮箱，无法发送</Alert>
              )}
              {reminderPreview.lastReminder && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  上次提醒：{reminderPreview.lastReminder.time}（当时设备 {reminderPreview.lastReminder.assetCount} 件{reminderPreview.lastReminder.assetCount === reminderPreview.assets.length ? '，设备数无变化' : ''}）
                </Alert>
              )}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 2 }}>
                <Typography variant="body2"><b>使用人：</b>{reminderPreview.userName}{reminderPreview.username && `（关联用户：${reminderPreview.username}）`}</Typography>
                <Typography variant="body2"><b>收件邮箱：</b>{reminderPreview.email || '—'}</Typography>
                <Typography variant="body2"><b>设备总数：</b>{reminderPreview.assets.length} 件</Typography>
              </Box>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>资产编号</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>资产名称</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>设备类型</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reminderPreview.assets.map((a) => (
                    <TableRow key={a.assetCode}>
                      <TableCell>{a.assetCode}</TableCell>
                      <TableCell>{a.name}</TableCell>
                      <TableCell>{a.type}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setReminderOpen(false)} disabled={reminderSending} sx={{ textTransform: 'none' }}>取消</Button>
          <Button
            variant="contained"
            disabled={reminderSending || !reminderPreview?.matched || !reminderPreview?.email || !reminderPreview?.smtpConfigured}
            onClick={handleSendReminder}
            sx={{ textTransform: 'none' }}
          >
            {reminderSending ? '发送中…' : '确认发送'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 关联使用人弹窗 */}
      <Dialog open={associateOpen} onClose={() => !associateSubmitting && setAssociateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>关联登录用户</DialogTitle>
        <DialogContent>
          {associateTarget && (
            <>
              <Typography variant="body2" sx={{ mb: 2 }}>
                使用人「<b>{associateTarget.userName}</b>」名下有 <b>{associateTarget.count}</b> 台设备未关联，请选择对应的登录用户：
              </Typography>
              <Autocomplete
                options={userOptions}
                getOptionLabel={(option) => `${option.displayName} (${option.username})`}
                value={associateUser}
                onChange={(_e, v) => setAssociateUser(v)}
                renderInput={(params) => <TextField {...params} label="选择登录用户" size="small" />}
                sx={{ mb: 1 }}
              />
              <Alert severity="info" sx={{ mt: 1 }}>
                确认后将：① 把该使用人名下 {associateTarget.count} 台设备关联到所选用户；② 若所选用户未设置中文姓名，将自动把「{associateTarget.userName}」写入其中文姓名。
              </Alert>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setAssociateOpen(false)} disabled={associateSubmitting} sx={{ textTransform: 'none' }}>取消</Button>
          <Button variant="contained" disabled={!associateUser || associateSubmitting} onClick={handleAssociate} sx={{ textTransform: 'none' }}>
            {associateSubmitting ? '关联中…' : '确认关联'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default Dashboard;