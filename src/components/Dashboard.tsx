import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
import {
  Inventory2 as AssetIcon,
  CheckCircle as InUseIcon,
  PauseCircle as IdleIcon,
  Build as RepairIcon,
  Delete as ScrapIcon,
  Warning as DamagedIcon,
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
import { DashboardStats, ChangeLog } from '../types';

const PIE_COLORS = ['#1a73e8', '#ff6d00', '#34a853', '#9334e6', '#ea4335', '#00bcd4', '#795548', '#607d8b'];

interface DashboardProps {
  globalSearch: string;
}

const Dashboard: React.FC<DashboardProps> = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

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

  const otherCount = stats.totalAssets - stats.inUseCount - stats.idleCount - stats.repairCount - stats.scrappedCount - (stats.damagedCount || 0);

  const statCards = [
    { label: '资产总数', value: stats.totalAssets, icon: <AssetIcon />, color: '#1a73e8', bgColor: '#e8f0fe' },
    { label: '在用', value: stats.inUseCount, icon: <InUseIcon />, color: '#34a853', bgColor: '#e6f4ea' },
    { label: '闲置', value: stats.idleCount, icon: <IdleIcon />, color: '#ff6d00', bgColor: '#fef3e2' },
    { label: '维修中', value: stats.repairCount, icon: <RepairIcon />, color: '#9334e6', bgColor: '#f3e8fd' },
    { label: '损坏', value: stats.damagedCount || 0, icon: <DamagedIcon />, color: '#ea4335', bgColor: '#fce8e6' },
    ...(otherCount > 0 ? [{ label: '其他状态', value: otherCount, icon: <ScrapIcon />, color: '#757575', bgColor: '#f5f5f5' }] : []),
    { label: '报废', value: stats.scrappedCount, icon: <ScrapIcon />, color: '#9e9e9e', bgColor: '#f5f5f5' },
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
            <Card
              elevation={0}
              sx={{
                border: '1px solid #e8eaed',
                borderRadius: 2,
                transition: 'box-shadow 0.2s',
                '&:hover': { boxShadow: '0 2px 12px rgba(0,0,0,0.08)' },
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
          </Grid>
        ))}
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
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                部门资产分布
              </Typography>
              {stats.departmentDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={stats.departmentDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis allowDecimals={false} fontSize={12} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" name="资产数量" fill="#1a73e8" radius={[4, 4, 0, 0]} />
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

      <Card elevation={0} sx={{ border: '1px solid #e8eaed', borderRadius: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
            近期变动记录
          </Typography>
          {stats.recentChangeLogs.length > 0 ? (
            <List dense>
              {stats.recentChangeLogs.map((log) => (
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
          ) : (
            <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
              暂无变动记录
            </Typography>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default Dashboard;