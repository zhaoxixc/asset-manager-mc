import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { getToken, clearToken, getRefreshToken, setToken, setRefreshToken } from '../utils/auth';
import useAuthStore from '../store/useAuthStore';

/** Axios实例：统一API请求配置 */
const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/** Token刷新锁，防止并发刷新 */
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

function addRefreshSubscriber(callback: (token: string) => void) {
  refreshSubscribers.push(callback);
}

/** 请求拦截器：自动附加Bearer Token */
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

/** 响应拦截器：统一错误处理 */
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error: AxiosError<{ code?: number; message?: string }>) => {
    const status = error.response?.status;
    const code = error.response?.data?.code;

    // 401 未授权：尝试刷新Token（带锁，防止并发刷新）
    if (status === 401 || code === 40100) {
      const refreshToken = getRefreshToken();

      if (refreshToken && !((error.config as InternalAxiosRequestConfig & { _retry?: boolean })._retry)) {
        const config = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
        config._retry = true;

        if (!isRefreshing) {
          isRefreshing = true;
          try {
            const res = await axios.post('/api/auth/refresh', { refreshToken });
            const { token: newToken, refreshToken: newRefreshToken } = res.data.data;
            setToken(newToken);
            setRefreshToken(newRefreshToken);
            onRefreshed(newToken);
            isRefreshing = false;
            // 重试原请求
            if (config.headers) {
              config.headers.Authorization = `Bearer ${newToken}`;
            }
            return api(config);
          } catch {
            isRefreshing = false;
            refreshSubscribers = [];
            clearToken();
            useAuthStore.setState({ currentUser: null, isAuthenticated: false });
            return Promise.reject(error);
          }
        }

        // 正在刷新中，排队等待
        return new Promise((resolve) => {
          addRefreshSubscriber((newToken: string) => {
            if (config.headers) {
              config.headers.Authorization = `Bearer ${newToken}`;
            }
            resolve(api(config));
          });
        });
      }

      // 无refreshToken，清除登录状态（不硬刷新页面）
      clearToken();
      useAuthStore.setState({ currentUser: null, isAuthenticated: false });
      return Promise.reject(error);
    }

    // 403 禁止访问
    if (status === 403 || code === 40300) {
      window.dispatchEvent(new CustomEvent('api-error', { detail: '没有权限执行此操作' }));
    }

    // 429 限流 - 不再打印到控制台，直接返回错误让组件处理
    if (status === 429 || code === 42900) {
      // 静默处理，由组件层显示错误信息
    }

    // 网络错误
    if (!error.response) {
      window.dispatchEvent(new CustomEvent('api-error', { detail: '网络连接失败，请检查网络' }));
    }

    return Promise.reject(error);
  }
);

export default api;