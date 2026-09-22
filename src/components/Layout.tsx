import React, { useState, useEffect } from 'react';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  TextField,
  InputAdornment,
  Divider,
  Avatar,
  Tooltip,
  Menu,
  MenuItem,
  Chip,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Inventory2 as AssetIcon,
  Business as DeptIcon,
  Category as CategoryIcon,
  FactCheck as InventoryIcon,
  People as UsersIcon,
  Search as SearchIcon,
  Menu as MenuIcon,
  Logout as LogoutIcon,
  Person as PersonIcon,
  History as AuditIcon,
  Settings as SettingsIcon,
  Lock as LockIcon,
} from '@mui/icons-material';
import Dashboard from './Dashboard';
import AssetTable from './AssetTable';
import DeptManager from './DeptManager';
import AssetTypeManager from './AssetTypeManager';
import AssetStatusManager from './AssetStatusManager';
import InventoryCheck from './InventoryCheck';
import UserManagement from './UserManagement';
import AuditLogPage from './AuditLogPage';
import SystemSettings from './SystemSettings';
import ChangePasswordDialog from './ChangePasswordDialog';
import useAssetStore from '../store/useAssetStore';
import useDeptStore from '../store/useDeptStore';
import useAuthStore from '../store/useAuthStore';
import api from '../services/api';
import { roleLabels, Role } from '../types';

/** 侧边栏宽度 */
const DRAWER_WIDTH = 240;

/** 导航项定义 */
interface NavItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  /** 需要的最低权限（null表示所有角色可见） */
  requiredRole?: string[] | null;
}

const navItems: NavItem[] = [
  { key: 'dashboard', label: '统计看板', icon: <DashboardIcon /> },
  { key: 'assets', label: '资产列表', icon: <AssetIcon /> },
  { key: 'departments', label: '部门管理', icon: <DeptIcon />, requiredRole: [Role.SUPER_ADMIN, Role.ADMIN] },
  { key: 'asset-types', label: '资产类型', icon: <CategoryIcon />, requiredRole: [Role.SUPER_ADMIN, Role.ADMIN] },
  { key: 'asset-statuses', label: '资产状态', icon: <InventoryIcon />, requiredRole: [Role.SUPER_ADMIN, Role.ADMIN] },
  { key: 'inventory', label: '资产盘点', icon: <InventoryIcon />, requiredRole: [Role.SUPER_ADMIN, Role.ADMIN] },
  { key: 'users', label: '用户管理', icon: <UsersIcon />, requiredRole: [Role.SUPER_ADMIN] },
  { key: 'audit-logs', label: '审计日志', icon: <AuditIcon />, requiredRole: [Role.SUPER_ADMIN] },
  { key: 'settings', label: '系统设置', icon: <SettingsIcon />, requiredRole: [Role.SUPER_ADMIN] },
];

/** 页面映射 */
const pageComponents: Record<string, React.FC<{ globalSearch: string }>> = {
  dashboard: Dashboard,
  assets: AssetTable,
  departments: DeptManager,
  'asset-types': AssetTypeManager,
  'asset-statuses': AssetStatusManager,
  inventory: InventoryCheck,
  users: UserManagement,
  'audit-logs': AuditLogPage,
  settings: SystemSettings,
};

interface LayoutProps {
  currentPage: string;
  onPageChange: (page: string) => void;
}

/** 主布局组件 */
const Layout: React.FC<LayoutProps> = ({ currentPage, onPageChange }) => {
  const [globalSearch, setGlobalSearch] = useState<string>('');
  const [assetJump, setAssetJump] = useState<{ field: 'user' | 'department' | 'status' | 'all'; value: string; nonce: number } | null>(null);
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);
  const [changePasswordOpen, setChangePasswordOpen] = useState<boolean>(false);
  const [companyName, setCompanyName] = useState<string>('');
  const [companyLogo, setCompanyLogo] = useState<string>('');

  // 初始化数据
  const fetchAssets = useAssetStore((s) => s.fetchAssets);
  const fetchDepartments = useDeptStore((s) => s.fetchDepartments);

  // 认证相关
  const currentUser = useAuthStore((s) => s.currentUser);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    fetchAssets();
    fetchDepartments();
    api.get('/system-info').then((res) => {
      const data = res.data.data || {};
      setCompanyName(data.company_name || '');
      setCompanyLogo(data.company_logo || '');
    }).catch(() => {});
  }, [fetchAssets, fetchDepartments]);

  /** 处理搜索 */
  const handleSearch = (value: string) => {
    setGlobalSearch(value);
    if (value && currentPage !== 'assets') {
      onPageChange('assets');
    }
  };

  /** 处理登出 */
  const handleLogout = async () => {
    setUserMenuAnchor(null);
    if (window.confirm('确定要退出登录吗？')) {
      await logout();
    }
  };

  /** 看板等页面跳转到资产列表并按使用人/部门/状态筛选 */
  const handleNavigateToAssets = (field: 'user' | 'department' | 'status' | 'all', value: string) => {
    setAssetJump({ field, value, nonce: Date.now() });
    onPageChange('assets');
  };

  /** 侧栏菜单切换（离开资产页时清除跳转筛选） */
  const handleNavPageChange = (page: string) => {
    if (page !== 'assets') setAssetJump(null);
    onPageChange(page);
    setMobileOpen(false);
  };

  /** 渲染页面内容 */
  const renderPage = () => {
    if (currentPage === 'dashboard') {
      return <Dashboard globalSearch={globalSearch} onNavigateToAssets={handleNavigateToAssets} />;
    }    if (currentPage === 'assets') {
      return <AssetTable globalSearch={globalSearch} jumpFilter={assetJump} />;
    }
    const Component = pageComponents[currentPage];
    if (!Component) return <Dashboard globalSearch={globalSearch} />;
    return <Component globalSearch={globalSearch} />;
  };

  /** 根据权限过滤导航项 */
  const visibleNavItems = navItems.filter((item) => {
    if (!item.requiredRole) return true;
    return currentUser && item.requiredRole.includes(currentUser.role);
  });

  /** 侧边栏内容 */
  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Logo区域 */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          minHeight: 64,
        }}
      >
        {companyLogo ? (
          <Box
            component="img"
            src={companyLogo}
            alt="Logo"
            sx={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 0.5 }}
          />
        ) : (
          <Avatar
            sx={{
              bgcolor: 'primary.main',
              width: 36,
              height: 36,
              fontSize: '0.9rem',
            }}
          >
            资
          </Avatar>
        )}
        <Typography variant="h6" noWrap sx={{ fontWeight: 800, fontSize: '1.05rem', color: 'text.primary', letterSpacing: 0.1 }}>
          {companyName || '资产管理系统'}
        </Typography>
      </Box>
      <Divider />
      {/* 导航列表 */}
      <List sx={{ flex: 1, pt: 1 }}>
        {visibleNavItems.map((item) => (
          <ListItem key={item.key} disablePadding sx={{ px: 1, mb: 0.5 }}>
            <ListItemButton
              selected={currentPage === item.key}
              onClick={() => {
                handleNavPageChange(item.key);
              }}
              sx={{
                borderRadius: 1.5,
                '&.Mui-selected': {
                  bgcolor: 'primary.main',
                  color: 'white',
                  '&:hover': { bgcolor: 'primary.dark' },
                  '& .MuiListItemIcon-root': { color: 'white' },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{ fontWeight: 600, fontSize: '0.92rem' }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider />
      {/* 当前用户信息 */}
      {currentUser && (
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Avatar sx={{ width: 28, height: 28, bgcolor: 'primary.main', fontSize: '0.75rem' }}>
              {currentUser.realName[0]}
            </Avatar>
            <Box sx={{ flex: 1, overflow: 'hidden' }}>
              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.86rem', color: 'text.primary' }} noWrap>
                {currentUser.realName}
              </Typography>
              <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.72rem', color: 'text.secondary', lineHeight: 1.5 }}>
                {roleLabels[currentUser.role as Role]}
              </Typography>
            </Box>
          </Box>
        </Box>
      )}
      <Box sx={{ px: 2, pb: 2, textAlign: 'center' }}>
        <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.76rem', color: 'text.secondary', letterSpacing: 0.15 }}>
          v6.06 · {companyName || '企业版'}
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      {/* 侧边栏 - 桌面端 */}
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            borderRight: '1px solid #e0e0e0',
          },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* 侧边栏 - 移动端 */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* 主内容区域 */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* 顶栏 */}
        <AppBar
          position="static"
          elevation={0}
          sx={{
            bgcolor: 'white',
            borderBottom: '1px solid #e0e0e0',
            color: 'text.primary',
          }}
        >
          <Toolbar>
            <IconButton
              edge="start"
              sx={{ mr: 2, display: { md: 'none' } }}
              onClick={() => setMobileOpen(true)}
            >
              <MenuIcon />
            </IconButton>
            <Typography
              variant="h6"
              noWrap
              sx={{ mr: 3, fontWeight: 600, color: 'primary.main' }}
            >
              {visibleNavItems.find((n) => n.key === currentPage)?.label || '统计看板'}
            </Typography>
            {/* 全局搜索框 */}
            <TextField
              size="small"
              placeholder="搜索资产名称、编号、使用人..."
              value={globalSearch}
              onChange={(e) => handleSearch(e.target.value)}
              sx={{
                width: 400,
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  bgcolor: '#f5f7fa',
                },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
            />
            <Box sx={{ flex: 1 }} />

            {/* 当前用户信息 + 菜单 */}
            {currentUser && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip
                  label={roleLabels[currentUser.role as Role]}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.7rem', height: 24 }}
                />
                <Tooltip title={currentUser.realName}>
                  <IconButton
                    size="small"
                    onClick={(e) => setUserMenuAnchor(e.currentTarget)}
                  >
                    <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '0.85rem' }}>
                      {currentUser.realName[0]}
                    </Avatar>
                  </IconButton>
                </Tooltip>
                <Menu
                  anchorEl={userMenuAnchor}
                  open={Boolean(userMenuAnchor)}
                  onClose={() => setUserMenuAnchor(null)}
                  transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                  anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                >
                  <MenuItem disabled>
                    <PersonIcon sx={{ mr: 1, fontSize: 18 }} />
                    {currentUser.realName} ({currentUser.username})
                  </MenuItem>
                  <Divider />
                  <MenuItem onClick={() => { setUserMenuAnchor(null); setChangePasswordOpen(true); }}>
                    <LockIcon sx={{ mr: 1, fontSize: 18 }} />
                    修改密码
                  </MenuItem>
                  <MenuItem onClick={handleLogout}>
                    <LogoutIcon sx={{ mr: 1, fontSize: 18 }} />
                    退出登录
                  </MenuItem>
                </Menu>
              </Box>
            )}
          </Toolbar>
        </AppBar>

        {/* 页面内容 */}
        <Box
          sx={{
            flex: 1,
            overflow: 'auto',
            p: { xs: 2, md: 3 },
            bgcolor: '#f5f7fa',
          }}
        >
          {renderPage()}
        </Box>
      </Box>

      {/* 修改密码对话框 */}
      <ChangePasswordDialog
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </Box>
  );
};

export default Layout;
