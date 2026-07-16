/** 应用配置 */
export const config = {
  /** 后端API端口（固定3001，与Nginx前端端口PORT分离，避免host网络模式下冲突） */
  port: parseInt(process.env.API_PORT || '3001', 10),
  /** JWT密钥 */
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-key',
  /** 数据库路径 */
  dbPath: process.env.DB_PATH || './data/asset-manager.db',
  /** Access Token 过期时间 */
  accessTokenExpiry: '2h',
  /** Refresh Token 过期时间 */
  refreshTokenExpiry: '7d',
  /** LDAP配置 */
  ldap: {
    enabled: process.env.LDAP_ENABLED === 'true',
    url: process.env.LDAP_URL || 'ldap://localhost:389',
    bindDN: process.env.LDAP_BIND_DN || '',
    bindPassword: process.env.LDAP_BIND_PASSWORD || '',
    searchBase: process.env.LDAP_SEARCH_BASE || 'ou=users,dc=example,dc=com',
    searchFilter: process.env.LDAP_SEARCH_FILTER || '(uid={username})',
    defaultRole: process.env.LDAP_DEFAULT_ROLE || 'user',
  },
};

if (!process.env.JWT_SECRET) {
  console.warn('[Config] WARNING: JWT_SECRET is not set. Using default "dev-secret-key". This is insecure for production!');
}
