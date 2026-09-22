-- 企业设备资产管理系统 数据库Schema
-- 使用 better-sqlite3 + WAL模式

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  real_name TEXT NOT NULL,
  cn_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  auth_source TEXT NOT NULL DEFAULT 'local',
  role TEXT NOT NULL DEFAULT 'user',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 资产表
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  asset_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  "user" TEXT NOT NULL DEFAULT '',
  owner_username TEXT NOT NULL DEFAULT '',
  purchase_date TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '在用',
  location TEXT NOT NULL DEFAULT '',
  remark TEXT NOT NULL DEFAULT '',
  wired_macs TEXT NOT NULL DEFAULT '[]',
  wireless_macs TEXT NOT NULL DEFAULT '[]',
  hostnames TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 部门表
CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 资产类型表
CREATE TABLE IF NOT EXISTS asset_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_asset_types_name ON asset_types(name);

-- 盘点任务表
CREATE TABLE IF NOT EXISTS inventory_tasks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 盘点记录表
CREATE TABLE IF NOT EXISTS inventory_records (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  asset_code TEXT NOT NULL DEFAULT '',
  asset_name TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '未盘点',
  remark TEXT NOT NULL DEFAULT '',
  checked_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (task_id) REFERENCES inventory_tasks(id)
);

-- 变动记录表
CREATE TABLE IF NOT EXISTS change_logs (
  id TEXT PRIMARY KEY,
  asset_code TEXT NOT NULL,
  asset_name TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 审计日志表
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  resource TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 登录锁定表
CREATE TABLE IF NOT EXISTS login_locks (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  fail_count INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 资产状态表（自定义状态）
CREATE TABLE IF NOT EXISTS asset_statuses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#757575',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_asset_statuses_name ON asset_statuses(name);

-- 资产编号前缀配置表
CREATE TABLE IF NOT EXISTS code_prefixes (
  id TEXT PRIMARY KEY,
  department TEXT NOT NULL DEFAULT '',
  prefix TEXT NOT NULL,
  suffix TEXT NOT NULL DEFAULT '',
  number_width INTEGER NOT NULL DEFAULT 4,
  last_seq INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_code_prefixes_prefix ON code_prefixes(prefix);

-- 邮件发送记录表
CREATE TABLE IF NOT EXISTS mail_logs (
  id TEXT PRIMARY KEY,
  to_email TEXT NOT NULL,
  username TEXT NOT NULL DEFAULT '',
  asset_count INTEGER NOT NULL DEFAULT 0,
  subject TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'sent',
  error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- AI 模型配置表
CREATE TABLE IF NOT EXISTS ai_models (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  api_key TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- AI 对话记录表
CREATE TABLE IF NOT EXISTS ai_chat_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '',
  username TEXT NOT NULL DEFAULT '',
  question TEXT NOT NULL DEFAULT '',
  answer TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'ok',
  error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 系统信息表（存储企业名称、Logo等全局配置）
CREATE TABLE IF NOT EXISTS system_info (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 系统信息默认数据
INSERT OR IGNORE INTO system_info (key, value) VALUES ('company_name', '');
INSERT OR IGNORE INTO system_info (key, value) VALUES ('company_logo', '');
INSERT OR IGNORE INTO system_info (key, value) VALUES ('audit_log_cleanup_enabled', 'false');
INSERT OR IGNORE INTO system_info (key, value) VALUES ('audit_log_retention_days', '365');
INSERT OR IGNORE INTO system_info (key, value) VALUES ('smtp_enabled', 'false');
INSERT OR IGNORE INTO system_info (key, value) VALUES ('smtp_host', '');
INSERT OR IGNORE INTO system_info (key, value) VALUES ('smtp_port', '465');
INSERT OR IGNORE INTO system_info (key, value) VALUES ('smtp_secure', 'true');
INSERT OR IGNORE INTO system_info (key, value) VALUES ('smtp_user', '');
INSERT OR IGNORE INTO system_info (key, value) VALUES ('smtp_pass', '');
INSERT OR IGNORE INTO system_info (key, value) VALUES ('smtp_from', '');
INSERT OR IGNORE INTO system_info (key, value) VALUES ('smtp_from_name', '');

-- 索引
CREATE INDEX IF NOT EXISTS idx_assets_code ON assets(asset_code);
CREATE INDEX IF NOT EXISTS idx_assets_name ON assets(name);
CREATE INDEX IF NOT EXISTS idx_assets_department ON assets(department);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type);
CREATE INDEX IF NOT EXISTS idx_inventory_records_task ON inventory_records(task_id);
CREATE INDEX IF NOT EXISTS idx_inventory_records_asset ON inventory_records(asset_id);
CREATE INDEX IF NOT EXISTS idx_change_logs_asset_code ON change_logs(asset_code);
CREATE INDEX IF NOT EXISTS idx_change_logs_created ON change_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_login_locks_username ON login_locks(username);
