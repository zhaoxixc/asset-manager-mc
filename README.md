# 企业设备资产管理系统 (Enterprise Asset Manager)

> 版本：v6.05 | 企业内部设备全生命周期管理平台

基于 React + Express + SQLite 的全栈资产管理系统，支持设备的录入、领用、归还、盘点、报废等全流程管理，提供可视化仪表盘和审计追踪。

---

## 功能特性

- **仪表盘** — 资产总数、部门分布、类型分布（图表展示）、最近变更记录
- **资产管理** — 增删改查、批量删除、Excel/CSV 导入导出、自定义资产编号规则
- **部门管理** — 增删改查，删除时资产可转移至其他部门
- **资产类型/状态** — 自定义类型与状态（状态支持颜色标识）
- **盘点管理** — 创建盘点任务，逐条核查资产
- **用户管理** — 增删改查、重置密码、角色控制（super_admin / admin / user）
- **审计日志** — 记录所有操作，支持按时间/用户/操作类型筛选和自动清理
- **系统设置** — 公司名称/Logo、资产编号前缀、数据库备份与恢复
- **LDAP 认证** — 可选对接企业域控（AD / OpenLDAP）
- **自动超时登出** — 30 分钟无操作自动退出

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | React 18 + TypeScript |
| 构建工具 | Vite 5 |
| UI 组件 | Material UI 5 + Tailwind CSS 3 |
| 状态管理 | Zustand 4 |
| 图表 | Recharts 2 |
| 后端框架 | Express 4 + TypeScript（tsx 运行） |
| 数据库 | SQLite（sql.js WASM，无需原生模块） |
| 认证 | JWT + bcryptjs |
| LDAP | ldapjs |
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
npm run dev             # 监听 http://localhost:3000，自动代理 /api 到 3001
```

### Docker 部署（推荐）

```bash
# 构建镜像
docker build -t asset-manager:6.05 .

# 运行容器
docker run -d --name asset-manager --network host \
  -v /opt/asset-manager/data:/app/server/data \
  -e JWT_SECRET=your-random-secret-here \
  -e TZ=Asia/Shanghai \
  -e PORT=8092 \
  --restart unless-stopped \
  asset-manager:6.05
```

> 详细部署配置请参考 [deploy-guide.md](deploy-guide.md)

---

## 默认账户

| 用户名 | 密码 | 角色 | 权限 |
|--------|------|------|------|
| `zhangsan` | `123456` | admin | 资产管理 |
| `lisi` | `123456` | user | 只读查看 |

---

## 项目结构

```
asset-manager-mc/
├── src/                          # 前端源码
│   ├── main.tsx                  # 入口
│   ├── App.tsx                   # 根组件（认证、主题、超时登出）
│   ├── types/index.ts            # TypeScript 类型定义
│   ├── services/api.ts           # Axios 实例（Token 刷新、错误处理）
│   ├── store/                    # Zustand 状态管理
│   │   ├── useAuthStore.ts
│   │   ├── useAssetStore.ts
│   │   ├── useDeptStore.ts
│   │   └── useInventoryStore.ts
│   └── components/               # 页面组件
│       ├── Login.tsx
│       ├── Dashboard.tsx
│       ├── AssetTable.tsx
│       ├── AssetForm.tsx
│       ├── DeptManager.tsx
│       ├── InventoryCheck.tsx
│       ├── UserManagement.tsx
│       ├── AuditLogPage.tsx
│       ├── SystemSettings.tsx
│       ├── ImportExport.tsx
│       └── ...
├── server/                       # 后端源码
│   ├── src/
│   │   ├── index.ts              # 入口
│   │   ├── app.ts                # Express 应用配置
│   │   ├── config/index.ts       # 环境变量配置
│   │   ├── database/             # 数据库（SQLite schema、migration、seed）
│   │   ├── middleware/           # JWT 认证、角色鉴权、限流
│   │   ├── services/             # 业务逻辑层
│   │   └── routes/               # API 路由
│   └── data/asset-manager.db     # SQLite 数据库文件
├── public/fonts/                 # Noto Sans SC 字体
├── docker/start.sh               # Docker 入口脚本
├── Dockerfile                    # Docker 构建文件
├── vite.config.ts                # Vite 配置
└── deploy-guide.md               # 部署指南
```

---

## 环境变量说明

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `JWT_SECRET` | `dev-secret-key` | **生产环境必须修改**，JWT 签名密钥 |
| `DB_PATH` | `./data/asset-manager.db` | 数据库文件路径 |
| `LDAP_ENABLED` | `false` | 是否启用 LDAP 域认证 |
| `LDAP_URL` | `ldap://ldap.example.com:389` | LDAP 服务器地址 |
| `LDAP_SEARCH_FILTER` | `(uid={username})` | LDAP 搜索过滤条件（AD 用 `(sAMAccountName={username})`） |

---

## License

Internal Use Only
