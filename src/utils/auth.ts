/** Token存储键名 */
const TOKEN_KEY = 'asset-token';
const REFRESH_TOKEN_KEY = 'asset-refresh-token';
const USER_KEY = 'asset-user';

/** 获取Access Token */
export const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

/** 设置Access Token */
export const setToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
};

/** 清除所有Token和用户信息 */
export const clearToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

/** 获取Refresh Token */
export const getRefreshToken = (): string | null => {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
};

/** 设置Refresh Token */
export const setRefreshToken = (token: string): void => {
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
};

/** 获取存储的用户信息 */
export const getStoredUser = (): Record<string, unknown> | null => {
  try {
    const userStr = localStorage.getItem(USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  } catch {
    return null;
  }
};

/** 设置存储的用户信息 */
export const setStoredUser = (user: unknown): void => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};
