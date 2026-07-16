import React, { useState, useEffect } from 'react';
import { ThemeProvider, createTheme, CssBaseline, Snackbar, Alert } from '@mui/material';
import Layout from './components/Layout';
import Login from './components/Login';
import useAuthStore from './store/useAuthStore';
import { getToken, getRefreshToken, setToken, setRefreshToken, clearToken } from './utils/auth';
import api from './services/api';

/** 企业级蓝色主题 */
const theme = createTheme({
  palette: {
    primary: {
      main: '#1a73e8',
      light: '#4791db',
      dark: '#115293',
    },
    secondary: {
      main: '#ff6d00',
      light: '#ff9e40',
      dark: '#c53e00',
    },
    background: {
      default: '#f5f7fa',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans SC", sans-serif',
    caption: {
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 600,
          backgroundColor: '#f0f4f8',
        },
      },
    },
  },
});

/** 无操作自动登出时间（30分钟） */
const INACTIVITY_MS = 30 * 60 * 1000;

/** 应用根组件 */
const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<string>('dashboard');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);
  const [globalError, setGlobalError] = useState<string>('');

  // 页面刷新时：如果有token，尝试静默刷新以延长会话
  // 只在已认证状态下尝试，避免未登录时不必要的请求
  useEffect(() => {
    const token = getToken();
    const refreshToken = getRefreshToken();
    if (token && refreshToken) {
      api.post('/auth/refresh', { refreshToken })
        .then((res) => {
          const { token: newToken, refreshToken: newRefreshToken } = res.data.data;
          setToken(newToken);
          setRefreshToken(newRefreshToken);
        })
        .catch(() => {
          // 刷新失败：token已过期，清除登录状态，React会自动切换到登录页
          clearToken();
          useAuthStore.setState({ currentUser: null, isAuthenticated: false });
        });
    } else if (token && !refreshToken) {
      // 只有accessToken但没有refreshToken，也清除（无法续期）
      clearToken();
      useAuthStore.setState({ currentUser: null, isAuthenticated: false });
    }
  }, []);

  // 无操作自动登出
  useEffect(() => {
    if (!isAuthenticated) return;
    let timeout: ReturnType<typeof setTimeout>;
    const resetTimer = () => {
      clearTimeout(timeout);
      timeout = setTimeout(async () => {
        // 自动登出：清除状态，React路由自然切换到登录页
        clearToken();
        useAuthStore.setState({ currentUser: null, isAuthenticated: false });
        window.dispatchEvent(new CustomEvent('api-error', { detail: '因长时间未操作，已自动登出' }));
        await logout();
      }, INACTIVITY_MS);
    };
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach((e) => window.addEventListener(e, resetTimer));
    resetTimer();
    return () => {
      clearTimeout(timeout);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, [isAuthenticated, logout]);

  // 全局错误处理
  useEffect(() => {
    const handleApiError = (event: CustomEvent) => {
      setGlobalError(event.detail || '操作失败');
    };
    window.addEventListener('api-error' as string, handleApiError as EventListener);
    return () => {
      window.removeEventListener('api-error' as string, handleApiError as EventListener);
    };
  }, []);

  // 未登录显示登录页
  if (!isAuthenticated) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Login />
        <Snackbar
          open={!!globalError}
          autoHideDuration={4000}
          onClose={() => setGlobalError('')}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert severity="error" onClose={() => setGlobalError('')}>
            {globalError}
          </Alert>
        </Snackbar>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Layout currentPage={currentPage} onPageChange={setCurrentPage} />
      <Snackbar
        open={!!globalError}
        autoHideDuration={4000}
        onClose={() => setGlobalError('')}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setGlobalError('')}>
          {globalError}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
};

export default App;
