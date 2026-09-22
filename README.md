# 企业设备资产管理系统 (Enterprise Asset Manager)

> 版本：**v6.06** ｜ 企业内部设备全生命周期管理平台

基于 React + Express + SQLite 的全栈资产管理系统，支持设备的录入、领用、归还、盘点、报废等全流程管理，提供可视化仪表盘、使用人设备数量排行、邮件提醒、LDAP 域账号集成、审计追踪与自动清理。

---

## 功能特性

- **仪表盘** — 资产状态统计卡片（可点击跳转）、部门/类型分布图表、使用人设备数量排行（分页/搜索/一键关联/发送邮件提醒）、近期变动
- **资产管理** — 增删改查、批量删除、Excel/CSV 全字段导入导出（含 MAC/主机名，导入自动关联使用人）、按部门自动生成资产编号
- **使用人关联体系** — 资产“使用人”与登录账号双向关联（表单下拉精确绑定 + 中文姓名自动匹配），支撑邮件提醒
- **部门管理** — 增删改查，删除时资产可转移至其他部门
- **资产类型/状态** — 自定义类型与状态（状态支持颜色标识）
- **盘点管理** — 创建盘点任务，逐条核查资产
- **用户管理** — 增删改查、重置密码、角色控制（super_admin / admin / user）、LDAP 同步（支持多搜索基址）
- **审计日志** — 全操作留痕、动态类型筛选、按保留天数自动清理（30~3650 天）
- **邮件提醒** — SMTP 配置 + 测试邮件，向设备过多的使用人发送提醒（含设备清单）
- **LDAP 认证** — 对接企业域控（OpenLDAP / AD），LDAP 权威模式，用户自动注册与信息同步
- **备份恢复** — 一键导出/恢复完整数据库

详细使用与运维说明见 **[docs/系统使用与运维手册.md](docs/系统使用与运维手册.md)**（含排错手册与 FAQ）。

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | React 18 + TypeScript + Vite 5 |
| UI 组件 | Material UI 5 + Tailwind CSS 3 |
| 状态管理 | Zustand 4 |
| 图表 | Recharts 2 |
| 后端框架 | Express 4 + TypeScript（tsx 运行） |
| 数据库 | SQLite（sql.js WASM，无需原生模块） |
| 认证 | JWT + bcryptjs + LDAP (ldapjs) |
| 邮件 | nodemailer |
| 容器化 | Docker 多阶段构建（Nginx + Node） |

---

## 快速开始

### 开发环境（需要 Node.js 18+）

```bash
# 1. 启动后端（终端 1）
cd server
npm install
cp .env.example .env    # 修改 JWT_SECRET（生产环境必须改）
npm run dev             # 监听 http://localhost:3001

# 2. 启动前端（终端 2）
cd ..
npm install
npm run dev             # 监听 http://localhost:5173，自动代理 /api 到 3001
```

### Docker 部署（推荐）

```bash
# 构建镜像
docker build -t asset-manager:6.06 .

# 启动（参考 start_v6.06_ldap.sh）
docker run -d \
  --name asset-manager-v6.06 \
  --network host \
  -v /opt/asset-manager/data:/app/server/data \
  --env-file server/.env \
  -e JWT_SECRET=***REMOVED*** \
  -e PORT=8092 \
  --restart unless-stopped \
  asset-manager:6.06
```

访问 `https://<服务器IP>:8092`（自签 HTTPS 证书）。

---

## 默认账户

| 用户名 | 初始密码 | 角色 | 权限 |
|--------|----------|------|------|
| `admin` | `admin123` | super_admin | 全部功能 |
| `zhangsan` | `123456` | admin | 资产管理 |
| `lisi` | `123456` | user | 只读查看 |

> 首次登录后请立即修改默认密码。LDAP 用户首次登录自动注册，默认角色 `user`。

---

## 项目结构

```
├── src/                          # 前端源码（页面组件、状态管理、类型）
│   ├── components/               # 各功能页面
│   ├── store/                    # Zustand 状态
│   ├── services/api.ts           # Axios 实例（Token 刷新、错误重试）
│   └── types/index.ts            # 类型定义
├── server/                       # 后端源码
│   ├── src/
│   │   ├── index.ts              # 入口（加载环境变量）
│   │   ├── config/               # 环境变量配置
│   │   ├── database/             # SQLite schema、迁移、种子数据
│   │   ├── middleware/           # JWT 认证、角色鉴权、限流
│   │   ├── services/             # 业务逻辑（资产/用户/LDAP/邮件/备份等）
│   │   └── routes/               # API 路由
│   ├── data/                     # 数据库文件（容器内挂载到数据卷）
│   └── .env.example              # 环境变量模板（含 LDAP/SMTP 说明）
├── docker/start.sh               # 容器入口（Nginx + 后端）
├── Dockerfile                    # 多阶段构建
├── start_v6.06_ldap.sh           # 生产启动脚本
└── docs/系统使用与运维手册.md      # 使用与运维手册（FAQ/排错）
```

---

## 环境变量说明（server/.env）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `JWT_SECRET` | dev-secret-key | **生产环境必须修改**，JWT 签名密钥 |
| `DB_PATH` | ./data/asset-manager.db | 数据库文件路径 |
| `LDAP_ENABLED` | false | 是否启用 LDAP 域认证 |
| `LDAP_URL` | — | LDAP 服务器地址 |
| `LDAP_BIND_DN` / `LDAP_BIND_PASSWORD` | — | 只读绑定账号（用于搜索用户） |
| `LDAP_SEARCH_BASE` | — | 搜索基址，多路径用 `\|` 分隔 |
| `LDAP_SEARCH_FILTER` | (uid={username}) | 登录名过滤器（AD 用 sAMAccountName） |
| `LDAP_DEFAULT_ROLE` | user | LDAP 用户自动注册的默认角色 |

> SMTP 邮件配置不在此处，直接在系统页面「系统设置 → 邮件通知」中配置。

---

## License

Internal Use Only
