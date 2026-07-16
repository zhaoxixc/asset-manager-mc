import { create } from 'zustand';
import { User, Role } from '../types';
import api from '../services/api';
import { setToken, setRefreshToken, clearToken, getStoredUser, setStoredUser, getToken } from '../utils/auth';

/** 认证状态接口 */
interface AuthState {
  /** 当前登录用户 */
  currentUser: User | null;
  /** Access Token */
  token: string | null;
  /** Refresh Token */
  refreshToken: string | null;
  /** 是否已认证 */
  isAuthenticated: boolean;
  /** 加载状态 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;

  /** 登录 */
  login: (username: string, password: string) => Promise<{ success: boolean; message: string }>;
  /** 登出 */
  logout: () => Promise<void>;
  /** 权限判断 */
  hasPermission: (action: 'create' | 'edit' | 'delete' | 'manage_users' | 'import') => boolean;
  /** 是否超级管理员 */
  isSuperAdmin: () => boolean;
  /** 清除错误 */
  clearError: () => void;
}

/** 使用认证状态管理 */
const useAuthStore = create<AuthState>()((set, get) => ({
  currentUser: getStoredUser() as User | null,
  token: null,
  refreshToken: null,
  isAuthenticated: !!getToken() && !!getStoredUser(),
  loading: false,
  error: null,

  /** 登录 */
  login: async (username: string, password: string) => {
    set({ loading: true, error: null });
    try {
      const res = await api.post('/auth/login', { username, password });
      const { token, refreshToken, user } = res.data.data;

      setToken(token);
      setRefreshToken(refreshToken);
      setStoredUser(user);

      set({
        currentUser: user,
        token,
        refreshToken,
        isAuthenticated: true,
        loading: false,
        error: null,
      });

      return { success: true, message: '登录成功' };
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '登录失败';
      set({ loading: false, error: message });
      return { success: false, message };
    }
  },

  /** 登出 */
  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // 忽略登出API错误
    }
    clearToken(); // clearToken now also clears storedUser
    set({
      currentUser: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      loading: false,
      error: null,
    });
  },

  /** 权限判断 */
  hasPermission: (action) => {
    const { currentUser } = get();
    if (!currentUser) return false;

    switch (currentUser.role) {
      case Role.SUPER_ADMIN:
        return true;
      case Role.ADMIN:
        return action !== 'manage_users';
      case Role.USER:
        return false;
      default:
        return false;
    }
  },

  /** 是否超级管理员 */
  isSuperAdmin: () => {
    const { currentUser } = get();
    return currentUser?.role === Role.SUPER_ADMIN;
  },

  /** 清除错误 */
  clearError: () => set({ error: null }),
}));

export default useAuthStore;
