# 增量PRD：企业设备资产管理系统 — 生产环境升级

## 项目信息

| 字段 | 值 |
|------|------|
| Language | 中文 |
| Programming Language | 前端：Vite + React 18 + TypeScript + MUI 5 + Tailwind CSS + Zustand；后端：Node.js + Express + TypeScript；数据库：SQLite |
| Project Name | asset-manager |
| 版本 | v2.0 (生产环境升级版) |

### 原始需求复述

将现有纯前端 SPA 资产管理系统改造为生产级系统。核心痛点：localStorage 数据不持久、无备份恢复机制、密码用 btoa 可逆编码缺乏安全性。目标是在内网 Linux/Windows 服务器上部署，供约50人规模的无锡沐创集成电路设计有限公司日常使用。

---

## 产品定义

### Product Goals

1. **数据持久可靠**：所有业务数据存储在服务端 SQLite 数据库中，多浏览器、多终端可共享访问，数据不丢失
2. **安全合规可用**：密码 bcrypt 哈希存储、JWT 无状态认证、接口权限校验，达到内网系统基本安全标准
3. **运维可备份恢复**：支持一键备份与一键恢复，确保数据可随时迁移与灾难恢复

### User Stories

1. **As a** IT运维人员, **I want to** 在任何电脑的浏览器上登录系统查看资产数据, **so that** 我不必绑定特定电脑办公
2. **As a** 系统管理员, **I want to** 一键备份全部数据并下载为文件, **so that** 即使服务器故障也能快速恢复
3. **As a** 系统管理员, **I want to** 通过上传备份文件一键恢复数据, **so that** 迁移或灾难恢复时不需要手动操作数据库
4. **As a** 普通用户, **I want to** 我的密码以安全方式存储, **so that** 即使数据库泄露也不会暴露明文密码
5. **As a** IT运维人员, **I want to** 系统部署在内网服务器上持续运行, **so that** 团队成员可以随时访问而不依赖某人的电脑

---

## 技术规范

### Requirements Pool

#### P0 — 必须实现（生产环境底线）

| 编号 | 需求 | 说明 |
|------|------|------|
| P0-01 | 后端 API 服务 | Node.js + Express + TypeScript，提供 RESTful API |
| P0-02 | SQLite 数据库 | 文件型数据库，建表迁移脚本，与前端类型对齐 |
| P0-03 | 前端 Store 改造 | Zustand store 从 localStorage persist 改为调用后端 API |
| P0-04 | JWT 认证 | 登录返回 JWT token，前端请求携带 Authorization header |
| P0-05 | bcrypt 密码哈希 | 密码使用 bcrypt 存储，废弃 btoa 编码 |
| P0-06 | 接口鉴权中间件 | 所有 API 需校验 JWT，按角色限制访问 |
| P0-07 | 数据备份（导出） | 将 SQLite 数据库文件打包为备份文件供下载 |
| P0-08 | 数据恢复（导入） | 上传备份文件覆盖恢复数据库 |
| P0-09 | 首次部署初始化 | 首次启动自动建表、创建默认 super_admin 账号 |
| P0-10 | 登录锁定迁移 | 后端实现登录失败锁定逻辑（3次失败锁定5分钟） |

#### P1 — 重要实现（提升可用性）

| 编号 | 需求 | 说明 |
|------|------|------|
| P1-01 | 操作审计日志 | 记录用户登录、数据增删改等关键操作，含操作人、时间、IP |
| P1-02 | JWT Token 刷新 | Access Token 短期（如2h）+ Refresh Token 长期（如7d），无感刷新 |
| P1-03 | 密码修改功能 | 用户自行修改密码（需验证旧密码），管理员重置密码 |
| P1-04 | CORS 配置 | 内网部署时配置允许的前端域名 |
| P1-05 | 请求限流 | 登录接口限流防暴力破解，通用接口限流防滥用 |
| P1-06 | 前端错误处理 | API 请求统一错误处理，401 自动跳转登录，网络异常提示 |
| P1-07 | 示例数据种子脚本 | 可选的数据库初始化种子脚本，用于演示和开发 |

#### P2 — 建议实现（锦上添花）

| 编号 | 需求 | 说明 |
|------|------|------|
| P2-01 | 定时自动备份 | 服务端定时（如每天凌晨）自动备份数据库文件到指定目录 |
| P2-02 | 数据库备份轮转 | 保留最近 N 份备份，自动清理过期备份 |
| P2-03 | HTTPS 支持 | 内网自签名证书或配置自定义证书 |
| P2-04 | 健康检查接口 | GET /api/health 供监控系统探活 |
| P2-05 | 系统配置管理 | 可配置的 JWT 密钥、过期时间、备份路径等，通过环境变量或配置文件 |

---

## 功能详细说明

### 1. 后端 API 服务 (P0-01)

**目标**：提供完整的 RESTful API，替代前端 localStorage 的所有数据操作。

**API 设计**：

```
认证模块
  POST   /api/auth/login          登录
  POST   /api/auth/logout         登出（可选：将 token 加入黑名单）
  POST   /api/auth/refresh        刷新 token（P1-02）
  PUT    /api/auth/password        修改密码（P1-03）

资产模块
  GET    /api/assets              资产列表（支持分页、筛选、排序）
  GET    /api/assets/:id          资产详情
  POST   /api/assets              新增资产
  PUT    /api/assets/:id          更新资产
  DELETE /api/assets/:id          删除资产
  POST   /api/assets/batch-delete 批量删除
  POST   /api/assets/import       批量导入
  GET    /api/assets/export       批量导出

部门模块
  GET    /api/departments         部门列表
  POST   /api/departments         新增部门
  PUT    /api/departments/:id     更新部门
  DELETE /api/departments/:id     删除部门

盘点模块
  GET    /api/inventory/tasks     盘点任务列表
  POST   /api/inventory/tasks     创建盘点任务
  PUT    /api/inventory/tasks/:id/records/:recordId  更新盘点记录

变动记录
  GET    /api/change-logs         变动记录列表

用户管理（super_admin 专用）
  GET    /api/users               用户列表
  POST   /api/users               新增用户
  PUT    /api/users/:id           更新用户
  DELETE /api/users/:id           删除用户
  PUT    /api/users/:id/reset-password  重置密码

数据看板
  GET    /api/dashboard/stats     看板统计数据

备份恢复
  GET    /api/backup              下载数据库备份文件
  POST   /api/backup/restore      上传备份文件恢复数据库

审计日志（P1-01）
  GET    /api/audit-logs          审计日志列表
```

**技术要点**：
- Express 路由按模块拆分（controllers / routes / services 分层）
- 统一响应格式：`{ code: number, message: string, data: any }`
- 统一错误处理中间件
- 请求参数校验（使用 zod 或 joi）

---

### 2. SQLite 数据库设计 (P0-02)

**目标**：与前端 TypeScript 类型对齐，建立服务端持久化存储。

**数据表设计**：

```sql
-- 用户表
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,        -- bcrypt 哈希
  real_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',  -- super_admin / admin / user
  status TEXT NOT NULL DEFAULT 'active', -- active / disabled
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 部门表
CREATE TABLE departments (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL
);

-- 资产表
CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  asset_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  model TEXT DEFAULT '',
  department TEXT DEFAULT '未分配',
  user TEXT DEFAULT '',
  purchase_date TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT '在用',
  location TEXT DEFAULT '',
  remark TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 盘点任务表
CREATE TABLE inventory_tasks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  department TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

-- 盘点记录表
CREATE TABLE inventory_records (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  asset_code TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT '未盘点',
  remark TEXT DEFAULT '',
  checked_at TEXT DEFAULT '',
  FOREIGN KEY (task_id) REFERENCES inventory_tasks(id)
);

-- 变动记录表
CREATE TABLE change_logs (
  id TEXT PRIMARY KEY,
  asset_code TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT DEFAULT '',
  timestamp TEXT NOT NULL
);

-- 审计日志表（P1-01）
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  username TEXT,
  action TEXT NOT NULL,
  resource TEXT,
  detail TEXT DEFAULT '',
  ip TEXT DEFAULT '',
  timestamp TEXT NOT NULL
);

-- 登录锁定记录表
CREATE TABLE login_locks (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  fail_count INTEGER DEFAULT 0,
  locked_until TEXT,
  updated_at TEXT NOT NULL
);
```

**技术要点**：
- 使用 better-sqlite3（同步API，性能优于 sqlite3）
- 数据库文件默认位置：`./data/asset-manager.db`
- 启动时自动执行迁移脚本建表（如表不存在则创建）
- SQLite WAL 模式提升并发读性能
- 前端字段采用 camelCase，数据库字段采用 snake_case，在 service 层做映射

---

### 3. 前端 Store 改造 (P0-03)

**目标**：将 4 个 Zustand store 从 localStorage persist 模式改为 API 调用模式。

**改造范围**：

| Store | 改造前 | 改造后 |
|-------|--------|--------|
| useAuthStore | localStorage persist，含用户列表和 currentUser | currentUser + JWT token 存 localStorage（仅认证状态），用户管理调 API |
| useAssetStore | localStorage persist | 移除 persist，全部调 API，内存缓存 |
| useDeptStore | localStorage persist | 移除 persist，全部调 API，内存缓存 |
| useInventoryStore | localStorage persist | 移除 persist，全部调 API，内存缓存 |

**关键变更**：
- 新增 `useApiStore` 或在现有 store 中引入 API 调用层
- 新增统一的 HTTP 请求工具（基于 fetch 或 axios），自动携带 JWT token
- Store 中保留数据缓存（避免每次渲染重新请求），在页面加载和操作后刷新
- 移除所有 `initSampleData` 逻辑（改为后端种子脚本）
- 移除 `hashPassword` / `verifyPassword` 前端工具（改为后端处理）

**认证流程变更**：
- 登录：`POST /api/auth/login` → 后端验证 → 返回 JWT token + 用户信息 → 前端存 token 到 localStorage
- 请求：所有 API 请求 header 携带 `Authorization: Bearer <token>`
- 登出：前端清除 token，跳转登录页
- Token 过期：401 响应 → 前端清除 token → 跳转登录页

---

### 4. JWT 认证体系 (P0-04)

**目标**：无状态认证，适合 SPA 架构。

**实现要点**：
- 登录成功后签发 JWT，payload 包含 `{ userId, username, role }`
- Access Token 有效期：2小时（P1-02 启用刷新后）
- Token 签发使用 `jsonwebtoken` 库
- JWT 密钥从环境变量 `JWT_SECRET` 读取，默认值仅供开发
- 前端在 401 响应时自动跳转登录页

**鉴权中间件**：
- `authMiddleware`：校验 JWT 有效性，提取用户信息挂载到 `req.user`
- `roleMiddleware(roles[])`：校验用户角色是否在允许列表中
- 应用方式：
  - 资产/部门/盘点/看板接口：需登录（任意角色）
  - 用户管理接口：仅 super_admin
  - 数据导入：admin 及以上
  - 备份恢复：仅 super_admin

---

### 5. bcrypt 密码哈希 (P0-05)

**目标**：废弃 btoa 可逆编码，使用 bcrypt 安全哈希。

**实现要点**：
- 使用 `bcryptjs` 库（纯 JS 实现，无需编译原生模块，部署简单）
- salt rounds 默认 10
- 首次部署时，默认管理员密码 `admin123` 以 bcrypt 哈希存入数据库
- 现有系统的 btoa 编码密码不做迁移（新系统全新部署）
- 密码校验流程：`bcrypt.compare(inputPassword, storedHash)`

---

### 6. 备份与恢复 (P0-07, P0-08)

**目标**：IT 运维人员可一键备份全部数据、一键恢复。

**备份功能 (P0-07)**：
- `GET /api/backup` → 服务端将 SQLite 数据库文件打包为 `.tar.gz` 或直接复制 `.db` 文件
- 响应为文件流下载，文件名格式：`asset-backup-YYYYMMDD-HHmmss.db`
- 备份前执行 SQLite `PRAGMA wal_checkpoint(TRUNCATE)` 确保 WAL 日志写入主文件
- 仅 super_admin 可操作

**恢复功能 (P0-08)**：
- `POST /api/backup/restore` → 上传 `.db` 备份文件
- 校验文件合法性（尝试打开、检查表结构）
- 替换当前数据库文件，重启服务（或关闭旧连接、切换到新文件）
- 恢复后强制所有用户重新登录（JWT 密钥不变，但数据库内容已变）
- 仅 super_admin 可操作
- 恢复前自动创建当前数据库的临时备份（防止恢复失败导致数据丢失）

**UI 设计**：
- 在系统设置页面增加「数据备份」和「数据恢复」两个操作区
- 备份：点击按钮 → 下载文件
- 恢复：上传文件 → 二次确认弹窗（提示「恢复将覆盖当前所有数据，是否继续？」）→ 执行恢复 → 提示重新登录

---

### 7. 首次部署初始化 (P0-09)

**目标**：部署即用，无需手动建表和创建账号。

**初始化流程**：
1. 启动后端服务
2. 检测数据目录 `./data/` 是否存在，不存在则创建
3. 检测 `asset-manager.db` 是否存在，不存在则执行建表迁移脚本
4. 检测 `users` 表是否为空，为空则插入默认 super_admin 账号（admin / admin123 bcrypt 哈希）
5. 首次登录后，系统提示修改默认密码（P1-03）

**环境变量配置**：
```
PORT=3001                    # 后端服务端口
JWT_SECRET=your-secret-key   # JWT 签名密钥
DB_PATH=./data/asset-manager.db  # 数据库文件路径
ADMIN_PASSWORD=admin123      # 初始管理员密码（可选覆盖默认值）
```

---

### 8. 登录锁定迁移 (P0-10)

**目标**：将前端 localStorage 中的锁定逻辑迁移到后端。

**实现要点**：
- 在 `login_locks` 表中记录每个用户名的失败次数和锁定截止时间
- 登录接口逻辑：
  1. 查询 login_locks，如当前时间 < locked_until，直接返回锁定提示
  2. 验证密码，失败则 fail_count + 1，达到 3 次则设置 locked_until = now + 5min
  3. 验证成功则清除该用户的锁定记录
- 锁定粒度：按用户名（而非 IP），与原系统行为一致

---

### 9. 操作审计日志 (P1-01)

**目标**：记录关键操作，满足内网系统的审计追溯需求。

**记录范围**：
- 用户登录/登出
- 资产增删改
- 部门增删改
- 盘点操作
- 用户管理操作（新增/删除/重置密码）
- 备份/恢复操作

**记录字段**：操作人（用户名）、操作类型、操作对象、详情、IP 地址、时间

**UI**：在系统设置中增加「审计日志」Tab，super_admin 可查看，支持按时间范围和操作类型筛选

---

### 10. 密码修改功能 (P1-03)

**目标**：用户可自行修改密码，管理员可重置其他用户密码。

**接口**：
- `PUT /api/auth/password`：用户修改自己的密码（需验证旧密码）
- `PUT /api/users/:id/reset-password`：管理员重置密码（仅 super_admin）

**安全规则**：
- 新密码长度至少6位
- 修改密码后不强制重新登录（当前 token 继续有效）
- 管理员重置密码后，被重置用户下次登录需用新密码

---

### 11. 前端错误处理与体验 (P1-06)

**目标**：API 化后，前端需有完善的错误处理机制。

**实现要点**：
- HTTP 请求工具统一拦截：
  - 401 → 清除 token，跳转登录页
  - 403 → 提示「无权限」
  - 500 → 提示「服务器错误」
  - 网络异常 → 提示「网络连接失败」
- 列表页面加载时显示 loading 状态
- 操作（新增/编辑/删除）后刷新列表
- 保持现有 MUI 风格，无额外 UI 改动需求

---

## 待确认问题

| 编号 | 问题 | 影响 | 建议 |
|------|------|------|------|
| Q1 | 内网部署是否需要 HTTPS？如果需要，证书如何获取？ | 后端配置复杂度 | 建议 P2 阶段支持，默认 HTTP 部署 |
| Q2 | 是否需要多用户并发编辑同一资产的冲突处理？ | 数据一致性 | 当前规模50人，冲突概率低，建议暂用「最后写入胜出」策略 |
| Q3 | 备份文件是否需要加密？ | 安全性 | 内网环境建议暂不加密，如需可在 P2 增加 AES 加密选项 |
| Q4 | 是否需要数据导入时的字段映射功能（Excel 列名与系统字段对齐）？ | 易用性 | 现有导入逻辑已在前端实现，迁移到后端时保持一致即可 |
| Q5 | JWT 密钥是否需要定期轮换？ | 安全性 | 建议 v2.0 暂不实现，后续版本可通过配置管理解决 |
| Q6 | 现有 localStorage 中的历史数据是否需要迁移工具？ | 部署过渡 | 考虑到系统尚未正式使用，建议不迁移，全新部署 |
| Q7 | 是否需要支持 Docker 部署？ | 部署方式 | 内网 Linux 环境 Docker 可简化部署，建议 P1 或 P2 阶段支持 |
