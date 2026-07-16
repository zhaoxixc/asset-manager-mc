/** 资产类型枚举 - 保留以兼容现有数据，但前端下拉选项改为从API获取 */
export enum AssetType {
  IT_DEVICE = 'IT设备',
  OFFICE_DEVICE = '办公设备',
  NETWORK_DEVICE = '网络设备',
  OTHER = '其他',
}

/** 资产状态枚举 - 保留默认值，前端下拉选项从API动态获取 */
export enum AssetStatus {
  IN_USE = '在用',
  IDLE = '闲置',
  REPAIR = '维修',
  DAMAGED = '损坏',
  SCRAPPED = '报废',
}

/** 资产实体 */
export interface Asset {
  id: string;
  assetCode: string;
  name: string;
  type: string;
  model: string;
  department: string;
  user: string;
  purchaseDate: string;
  status: string;
  location: string;
  remark: string;
  wiredMacs?: string[];
  wirelessMacs?: string[];
  hostnames?: string[];
  createdAt: string;
  updatedAt: string;
}

/** 资产类型项（从API获取） */
export interface AssetTypeItem {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  assetCount?: number;
}

/** 资产状态项（从API获取） */
export interface AssetStatusItem {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
  assetCount?: number;
}

/** 编号前缀配置项 */
export interface CodePrefixItem {
  id: string;
  department: string;
  prefix: string;
  suffix: string;
  numberWidth: number;
  lastSeq: number;
  createdAt: string;
  updatedAt: string;
}

/** 部门实体 */
export interface Department {
  id: string;
  name: string;
  createdAt: string;
  assetCount?: number;
}

/** 盘点状态枚举 */
export enum InventoryStatus {
  CHECKED = '已盘点',
  UNCHECKED = '未盘点',
  ABNORMAL = '异常',
}

/** 盘点记录 */
export interface InventoryRecord {
  id: string;
  taskId: string;
  assetId: string;
  assetCode: string;
  assetName: string;
  department: string;
  status: InventoryStatus;
  remark: string;
  checkedAt: string;
  createdAt: string;
  updatedAt: string;
}

/** 盘点任务 */
export interface InventoryTask {
  id: string;
  name: string;
  department: string;
  createdAt: string;
  updatedAt: string;
  records: InventoryRecord[];
}

/** 变动记录 */
export interface ChangeLog {
  id: string;
  assetCode: string;
  assetName: string;
  action: string;
  detail: string;
  createdAt: string;
}

/** 资产表单数据（新增/编辑） */
export interface AssetFormData {
  assetCode: string;
  name: string;
  type: string;
  model: string;
  department: string;
  user: string;
  purchaseDate: string;
  status: string;
  location: string;
  remark: string;
  wiredMacs?: string[];
  wirelessMacs?: string[];
  hostnames?: string[];
}

/** 筛选条件 */
export interface FilterCondition {
  keyword: string;
  type: string;
  department: string;
  status: string;
  location: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

/** 角色枚举 */
export enum Role {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  USER = 'user',
}

/** 角色显示名称映射 */
export const roleLabels: Record<Role, string> = {
  [Role.SUPER_ADMIN]: '超级管理员',
  [Role.ADMIN]: '管理员',
  [Role.USER]: '普通用户',
};

/** 用户状态枚举 */
export enum UserStatus {
  ACTIVE = 'active',
  DISABLED = 'disabled',
}

/** 用户实体 */
export interface User {
  id: string;
  username: string;
  realName: string;
  role: Role;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

/** 默认筛选条件 */
export const defaultFilter: FilterCondition = {
  keyword: '',
  type: '',
  department: '',
  status: '',
  location: '',
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

/** API统一响应格式 */
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

/** 分页数据 */
export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** 登录响应 */
export interface LoginResponse {
  token: string;
  refreshToken: string;
  user: User;
}

/** 看板统计 */
export interface DashboardStats {
  totalAssets: number;
  inUseCount: number;
  idleCount: number;
  repairCount: number;
  scrappedCount: number;
  damagedCount: number;
  typeDistribution: { name: string; value: number }[];
  departmentDistribution: { name: string; count: number }[];
  recentChangeLogs: ChangeLog[];
  statusCounts: { name: string; count: number; color: string }[];
}

/** 审计日志 */
export interface AuditLog {
  id: string;
  userId: string;
  username: string;
  action: string;
  resource: string;
  detail: string;
  ip: string;
  createdAt: string;
}
