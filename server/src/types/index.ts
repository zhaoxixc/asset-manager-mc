/** 数据库行类型定义（snake_case，与数据库表一致） */

/** 用户表行 */
export interface UserRow {
  id: string;
  username: string;
  password: string;
  real_name: string;
  role: string;
  status: string;
  created_at: string;
  updated_at: string;
}

/** 资产表行 */
export interface AssetRow {
  id: string;
  asset_code: string;
  name: string;
  type: string;
  model: string;
  department: string;
  user: string;
  purchase_date: string;
  status: string;
  location: string;
  remark: string;
  created_at: string;
  updated_at: string;
}

/** 部门表行 */
export interface DepartmentRow {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

/** 资产类型表行 */
export interface AssetTypeRow {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

/** 盘点任务表行 */
export interface InventoryTaskRow {
  id: string;
  name: string;
  department: string;
  created_at: string;
  updated_at: string;
}

/** 盘点记录表行 */
export interface InventoryRecordRow {
  id: string;
  task_id: string;
  asset_id: string;
  asset_code: string;
  asset_name: string;
  department: string;
  status: string;
  remark: string;
  checked_at: string;
  created_at: string;
  updated_at: string;
}

/** 变动记录表行 */
export interface ChangeLogRow {
  id: string;
  asset_code: string;
  asset_name: string;
  action: string;
  detail: string;
  created_at: string;
}

/** 审计日志表行 */
export interface AuditLogRow {
  id: string;
  user_id: string;
  username: string;
  action: string;
  resource: string;
  detail: string;
  ip: string;
  created_at: string;
}

/** 资产状态表行 */
export interface AssetStatusRow {
  id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

/** 编号前缀配置行 */
export interface CodePrefixRow {
  id: string;
  department: string;
  prefix: string;
  last_seq: number;
  created_at: string;
  updated_at: string;
}

/** 登录锁定表行 */
export interface LoginLockRow {
  id: string;
  username: string;
  fail_count: number;
  locked_until: string | null;
  created_at: string;
  updated_at: string;
}

/** JWT Payload */
export interface JwtPayload {
  userId: string;
  username: string;
  role: string;
  type?: string;
}

/** API统一响应格式 */
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

/** 分页查询结果 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
