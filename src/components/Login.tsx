import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  Avatar,
  InputAdornment,
  IconButton,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  Lock as LockIcon,
  Visibility,
  VisibilityOff,
  Inventory2 as AssetIcon,
} from '@mui/icons-material';
import useAuthStore from '../store/useAuthStore';
import api from '../services/api';

/** 登录页面组件 */
const Login: React.FC = () => {
  const login = useAuthStore((s) => s.login);
  const loading = useAuthStore((s) => s.loading);

  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [ldapEnabled, setLdapEnabled] = useState<boolean>(false);
  const [companyName, setCompanyName] = useState<string>('');
  const [companyLogo, setCompanyLogo] = useState<string>('');
  const [logoError, setLogoError] = useState<boolean>(false);

  useEffect(() => {
    api.get('/auth/ldap-status').then((res) => {
      setLdapEnabled(res.data.data?.enabled || false);
    }).catch(() => {
      setLdapEnabled(false);
    });
    api.get('/system-info').then((res) => {
      const data = res.data.data || {};
      setCompanyName(data.company_name || '');
      setCompanyLogo(data.company_logo || '');
    }).catch(() => {});
  }, []);

  /** 处理登录 */
  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setErrorMsg('请输入用户名和密码');
      return;
    }
    const result = await login(username.trim(), password);
    if (!result.success) {
      setErrorMsg(result.message);
    }
  };

  /** 处理回车 */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1a73e8 0%, #0d47a1 50%, #1565c0 100%)',
        p: 2,
      }}
    >
      <Card
        sx={{
          width: '100%',
          maxWidth: 420,
          borderRadius: 3,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            {companyLogo && !logoError ? (
              <Box
                component="img"
                src={companyLogo}
                alt="Logo"
                onError={() => setLogoError(true)}
                sx={{ width: 64, height: 64, objectFit: 'contain', mx: 'auto', mb: 2, borderRadius: 1 }}
              />
            ) : (
              <Avatar
                sx={{
                  width: 64,
                  height: 64,
                  bgcolor: 'primary.main',
                  mx: 'auto',
                  mb: 2,
                  fontSize: '1.8rem',
                }}
              >
                <AssetIcon />
              </Avatar>
            )}
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main', mb: 0.5 }}>
              {companyName || '企业设备资产管理系统'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {companyName ? 'Enterprise Asset Management System' : 'Enterprise Asset Management System'}
            </Typography>
          </Box>

          {errorMsg && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 1 }}>
              {errorMsg}
            </Alert>
          )}

          <TextField
            fullWidth
            label="用户名"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setErrorMsg('');
            }}
            onKeyDown={handleKeyDown}
            disabled={loading}
            size="small"
            sx={{ mb: 2 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                </InputAdornment>
              ),
            }}
          />

          <TextField
            fullWidth
            label="密码"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setErrorMsg('');
            }}
            onKeyDown={handleKeyDown}
            disabled={loading}
            size="small"
            sx={{ mb: 3 }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <Button
            fullWidth
            variant="contained"
            size="large"
            onClick={handleLogin}
            disabled={loading}
            sx={{
              textTransform: 'none',
              py: 1.2,
              fontSize: '1rem',
              fontWeight: 600,
              borderRadius: 1.5,
            }}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : '登 录'}
          </Button>

          {ldapEnabled && (
            <>
              <Divider sx={{ my: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  支持域账号登录
                </Typography>
              </Divider>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
                LDAP域账号可直接使用域用户名和密码登录
              </Typography>
            </>
          )}

          <Box sx={{ mt: 4, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">
                企业设备资产管理系统 
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Login;
