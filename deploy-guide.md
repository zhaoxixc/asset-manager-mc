# 企业设备资产管理系统 — 部署指南

> 版本：2.3 | 日期：2026-05-29
> 架构：React + Express + SQLite + JWT + LDAP，Docker 一键部署

---

## 目录

1. [架构概览](#架构概览)
2. [功能亮点](#功能亮点)
3. [预设账户](#预设账户)
4. [快速启动（开发模式）](#快速启动开发模式)
5. [生产部署 — 方案一：Nginx](#方案一nginx-部署推荐)
6. [生产部署 — 方案二：Docker](#方案二docker-部署跨平台通用)
7. [LDAP 域账号登录配置](#ldap-域账号登录配置)
8. [企业信息与 Logo 配置](#企业信息与-logo-配置)
9. [数据备份策略](#数据备份策略)
10. [重要注意事项](#重要注意事项)
11. [部署检查清单](#部署检查清单)
12. [更新部署](#更新部署)
13. [服务器配置建议](#服务器配置建议)
14. [常见问题 FAQ](#常见问题-faq)

---

## 架构概览

```
┌───────────────────────────────────────────────────────────────┐
│                        浏览器 (Client)                         │
│  ┌────────────┐  ┌──────────┐  ┌─────────────────────────┐  │
│  │ React SPA  │  │ Zustand  │  │ localStorage             │  │
│  │ (前端UI)   │──│ (状态管理)│──│ (JWT Token 缓存)         │  │
│  └─────┬──────┘  └──────────┘  └─────────────────────────┘  │
│        │ HTTP (Axios + Bearer Token)                          │
└────────┼──────────────────────────────────────────────────────┘
         │
         ▼
┌───────────────────────────────────────────────────────────────┐
│  Nginx（Docker 内置 / 独立部署）                               │
│  ├─ /                     → dist/ 静态文件 (React SPA)         │
│  ├─ /api/system-info/logo → Logo 图片                         │
│  └─ /api/*                → proxy_pass http://127.0.0.1:3001 │
└───────────────────────────────────────────────────────────────┘
         │
         ▼
┌───────────────────────────────────────────────────────────────┐
│  Node.js 后端 (Express, 端口 3001)                             │
│  ├─ JWT 认证 + LDAP 认证 + 角色权限 (super_admin/admin/user) │
│  ├─ 业务 API (资产/部门/盘点/用户/审计/状态/编号前缀/企业信息)  │
│  ├─ 资产全量导出 API (/api/assets/export)                     │
│  └─ 备份/恢复 API                                             │
│         │                                                     │
│         ▼                                                     │
│  ┌─────────────────────────────────────────┐                  │
│  │ SQLite 数据库 (sql.js WASM)              │                  │
│  │ 文件: ./data/asset-manager.db            │                  │
│  └─────────────────────────────────────────┘                  │
│         │ 可选                                                │
│         ▼                                                     │
│  ┌─────────────────────────────────────────┐                  │
│  │ LDAP 服务器 (AD / OpenLDAP)              │                  │
│  └─────────────────────────────────────────┘                  │
└───────────────────────────────────────────────────────────────┘
```

---

## 功能亮点

- ✅ **全栈应用**：React 前端 + Express 后端 + SQLite 数据库，单容器部署
- ✅ **数据持久化**：所有数据存储在 SQLite 数据库文件，挂载卷即可持久化
- ✅ **多用户共享**：不同浏览器/电脑登录同一地址即可共享数据
- ✅ **统一字体**：内嵌思源黑体（Noto Sans SC），所有平台显示一致，无需联网加载字体
- ✅ **JWT 认证**：Access Token (2h) + Refresh Token (7d)，30 分钟无操作自动登出
- ✅ **LDAP 域账号**：支持 Active Directory / OpenLDAP，首次登录自动创建本地用户
- ✅ **自定义编号前缀**：按部门配置，支持前缀+后缀+序号位数的灵活组合（如 MC-IT-2026-00001）
- ✅ **自定义资产状态**：新增/编辑/删除状态，支持颜色自定义
- ✅ **自定义资产类型**：动态管理资产类型
- ✅ **企业信息配置**：设置企业名称和 Logo，显示在侧边栏和登录页
- ✅ **全量导出**：导出 Excel/CSV 时导出所有资产，非仅当前页
- ✅ **服务端分页**：默认每页 20 条，支持 20/50/100，支持跳页
- ✅ **审计日志清理**：可配置自动清理策略（默认关闭），保留天数可调（30-3650天）
- ✅ **审计日志筛选**：支持按操作类型、用户名、日期范围筛选，支持页码跳转
- ✅ **看板饼图优化**：资产类型分布饼图中小于5%的扇区不显示标签和引线，避免重叠
- ✅ **备份恢复**：一键导出/导入 .db 数据库文件
- ✅ **密码强度**：最少 6 位，需包含字母和数字
- ✅ **搜索增强**：支持按名称、编号、使用人、备注模糊搜索
- ✅ **大规模数据支持**：SQLite 可处理百万级行，编号序号位数可配（3-8位，最大9999万）

---

## 预设账户

| 用户名 | 初始密码 | 角色 | 说明 |
|--------|---------|------|------|
| admin | admin123 | super_admin | 系统管理员（所有权限） |
| zhangsan | 123456 | admin | 资产管理员（管理资产） |
| lisi | 123456 | user | 普通用户（只读） |

> ⚠️ **首次部署后请尽快修改默认密码！** LDAP 启用后，域账号可直接登录。

---

## 快速启动（开发模式）

适合本地开发调试，无需 Nginx：

```bash
# 1. 进入项目目录
cd asset-manager

# 2. 安装前端依赖
npm install

# 3. 安装后端依赖
cd server
npm install

# 4. 创建 .env 配置文件
cp .env.example .env
# 编辑 .env 修改 JWT_SECRET（生产环境必须修改！）
# 如需 LDAP，配置 LDAP_ENABLED=true 及相关参数

# 5. 启动后端（端口 3001）
npm run dev

# 6. 新开终端，启动前端（端口 3000，自动代理 /api → 3001）
cd ..
npm run dev
```

浏览器访问 `http://localhost:3000`，使用 admin / admin123 登录。

---

## 方案一：Nginx 部署（推荐）

适用于 Linux 服务器，Nginx 做前端反向代理 + 静态文件服务。

### 1. 安装 Node.js 和 Nginx

```bash
# Ubuntu / Debian
sudo apt update
sudo apt install -y nginx
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# CentOS / RHEL
sudo yum install -y nginx
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs
```

### 2. 构建前端

```bash
cd asset-manager
npm install
npm run build        # 产物在 dist/ 目录
```

### 3. 配置后端

```bash
cd server
npm install
cp .env.example .env
```

编辑 `server/.env`：

```ini
# ===== 必填 =====
PORT=3001                                      # 后端 API 端口（通常不改）
JWT_SECRET=改为你自己的随机密钥                    # ⚠️ 必须修改！可用下面命令生成：
                                               # node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
DB_PATH=./data/asset-manager.db                # 数据库文件路径

# ===== LDAP 配置（不需要域账号登录则保持关闭）=====
LDAP_ENABLED=false
# LDAP_URL=ldap://ldap.example.com:389         # LDAP 服务器地址
# LDAP_BIND_DN=cn=admin,dc=example,dc=com       # 管理员绑定 DN
# LDAP_BIND_PASSWORD=your-bind-password          # 管理员密码
# LDAP_SEARCH_BASE=ou=users,dc=example,dc=com   # 用户搜索基准 DN
# LDAP_SEARCH_FILTER=(uid={username})            # 搜索过滤器，{username} 会替换为登录用户名
# LDAP_DEFAULT_ROLE=user                         # LDAP 用户首次登录的默认角色
```

### 4. 配置 Nginx

```bash
sudo nano /etc/nginx/conf.d/asset-manager.conf
```

```nginx
server {
    listen       80;
    server_name  _;

    # 前端静态文件
    root /usr/share/nginx/asset-manager;
    index index.html;

    # API 反向代理到后端
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50m;           # Logo 上传和数据库备份可能较大
    }

    # SPA 路由 fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源长期缓存
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # 禁止访问数据库文件
    location ~ /\.db {
        deny all;
    }

    # Gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    gzip_min_length 1024;
}
```

### 5. 部署文件并启动

```bash
# 部署前端静态文件
sudo mkdir -p /usr/share/nginx/asset-manager
cp -r dist/* /usr/share/nginx/asset-manager/

# 部署后端
sudo mkdir -p /opt/asset-manager/server/data
cp -r server/* /opt/asset-manager/server/

# 创建 systemd 服务
sudo nano /etc/systemd/system/asset-manager.service
```

```ini
[Unit]
Description=Asset Manager Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/asset-manager/server
ExecStart=/usr/bin/node /opt/asset-manager/server/node_modules/.bin/tsx src/index.ts
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
# 设置数据目录权限
sudo chown -R www-data:www-data /opt/asset-manager/server/data

# 启动服务
sudo systemctl daemon-reload
sudo systemctl start asset-manager
sudo systemctl enable asset-manager

# 启动 Nginx
sudo nginx -t && sudo systemctl restart nginx && sudo systemctl enable nginx

# 验证
curl http://localhost:3001/api/health
# 应返回 {"code":0,"message":"success",...}
```

---

## 方案二：Docker 部署（跨平台通用）

最简单的部署方式，一个容器包含 Nginx + Node.js 后端 + 前端。

### 1. 构建镜像

```bash
cd asset-manager    # 进入项目根目录（Dockerfile 所在目录）

# 构建镜像（标签为 asset-manager:6.03）
docker build -t asset-manager:6.03 .
```

> 构建过程分三个阶段：前端构建 → 后端依赖安装 → 运行镜像打包。首次构建约需 3-5 分钟。

### 2. 运行容器

#### 最简启动（不启用 LDAP）

```bash
docker run -d \
    --name asset-manager \
    --network host \
    -v /opt/asset-manager/data:/app/server/data \
    -e JWT_SECRET=请改为你自己的随机密钥 \
    -e TZ=Asia/Shanghai \
    -e PORT=8092 \
    --restart unless-stopped \
    asset-manager:6.03
```

访问地址：`https://服务器IP:8092`

> Docker 镜像默认启用 HTTPS。首次启动时会在 `/app/server/data/certs` 自动生成 100 年自签名证书；由于是自签名证书，浏览器会提示“不安全”，企业内网可选择继续访问。
> 如果误用 `http://服务器IP:8092` 访问，Nginx 会自动跳转到 `https://服务器IP:8092`。

参数说明：

| 参数 | 说明 |
|------|------|
| `-d` | 后台运行 |
| `--name asset-manager` | 容器名称 |
| `--network host` | 使用主机网络，容器直接使用宿主机的网络栈，无需端口映射 |
| `-v /opt/asset-manager/data:/app/server/data` | **关键！** 将数据库目录挂载到宿主机，防止容器重建后数据丢失 |
| `-e JWT_SECRET=...` | **必须修改！** JWT 签名密钥，不同部署应使用不同密钥 |
| `-e TZ=Asia/Shanghai` | **推荐设置！** 容器时区，影响审计日志等时间记录。不设置则为 UTC |
| `--restart unless-stopped` | 容器异常退出时自动重启 |
| `-e PORT=8092` | Nginx 对外访问端口。默认 HTTPS 端口为 443；建议内网部署时显式指定，例如 8092 |
| `asset-manager:6.03` | 使用的镜像名:标签 |

#### 默认端口说明

| 端口 | 用途 | 环境变量 |
|------|------|---------|
| 443 | Nginx HTTPS 前端（给浏览器访问） | `PORT=443`（HTTPS 默认） |
| 3001 | Node.js 后端 API（容器内部） | `API_PORT=3001`（默认，通常不改） |

> ⚠️ 使用 `--network host` 时，容器内 Nginx 监听的 `PORT` 会直接占用宿主机端口。如果宿主机该端口已被占用，请修改 `PORT`。

#### 自定义访问端口（如改为 8092）

```bash
docker run -d \
    --name asset-manager \
    --network host \
    -v /opt/asset-manager/data:/app/server/data \
    -e JWT_SECRET=请改为你自己的随机密钥 \
    -e TZ=Asia/Shanghai \
    -e PORT=8092 \
    --restart unless-stopped \
    asset-manager:6.03
```

访问地址变为 `https://服务器IP:8092`

> 注意：后端 API 固定在容器内部 3001 端口运行，Nginx 自动代理到它，无需额外配置。

#### HTTPS 自签名证书配置

默认情况下，容器会自动生成并复用自签名证书：

| 路径 | 说明 |
|------|------|
| `/app/server/data/certs/server.crt` | 自签名证书 |
| `/app/server/data/certs/server.key` | 私钥 |
| `/opt/asset-manager/data/certs/` | 挂载到宿主机后的实际保存目录 |

可选环境变量：

| 环境变量 | 说明 | 示例 |
|---------|------|------|
| `SSL_CN` | 证书通用名称 | `192.168.1.20` |
| `SSL_ALT_NAMES` | 证书 SAN，多个值用英文逗号分隔 | `IP:192.168.1.20,DNS:asset-manager.local` |
| `HTTP_ONLY` | 设置为 `true` 时关闭 HTTPS，改用 HTTP | `true` |

如果希望证书里包含服务器内网 IP，可首次启动时指定：

```bash
-e SSL_CN=192.168.1.20 \
-e SSL_ALT_NAMES=IP:192.168.1.20,DNS:asset-manager.local
```

> 如果证书已经生成，修改 `SSL_CN` 或 `SSL_ALT_NAMES` 不会自动重签。需要先删除宿主机 `/opt/asset-manager/data/certs` 后再重启容器。

#### 启用 LDAP 域账号登录（核心场景）

以下是一个**完整的企业部署示例**，包含所有常用环境变量的详细注释：

```bash
docker run -d \
    --name asset-manager \
    --network host \
    -v /opt/asset-manager/data:/app/server/data \
    \
    # ===== 基础配置 =====
    -e JWT_SECRET=9a3f7c2e1b8d4f6e5a0c3b7e9d2f4a1c6b8e0f3a7d5c9b2e6f8a4d1c7e9b3f5 \
    -e TZ=Asia/Shanghai \
    -e PORT=8092 \
    \
    # ===== LDAP 配置（与公司域控对接）=====
    -e LDAP_ENABLED=true \
    -e LDAP_URL=ldap://192.168.1.10:389 \
    -e LDAP_BIND_DN="CN=ldap_query,OU=服务账号,DC=company,DC=com" \
    -e LDAP_BIND_PASSWORD=YourSecureBindPassword123 \
    -e LDAP_SEARCH_BASE="OU=员工,DC=company,DC=com" \
    -e LDAP_SEARCH_FILTER="(sAMAccountName={username})" \
    -e LDAP_DEFAULT_ROLE=user \
    \
    --restart unless-stopped \
    asset-manager:6.03
```

各 LDAP 环境变量详细说明：

| 环境变量 | 必填 | 说明 | 示例 |
|---------|------|------|------|
| `LDAP_ENABLED` | 是 | 是否启用 LDAP 认证。`true` 启用，`false`（默认）禁用 | `true` |
| `LDAP_URL` | 是 | LDAP 服务器地址和端口。`ldap://` 为明文，`ldaps://` 为加密连接 | `ldap://192.168.1.10:389` 或 `ldaps://ldap.company.com:636` |
| `LDAP_BIND_DN` | 是 | 管理员绑定 DN。需要有搜索用户目录的权限，通常是一个专用的服务账号 | `CN=ldap_query,OU=服务账号,DC=company,DC=com` |
| `LDAP_BIND_PASSWORD` | 是 | 管理员绑定密码。⚠️ 该密码以环境变量形式存在于容器中，请确保服务器安全 | `YourSecureBindPassword123` |
| `LDAP_SEARCH_BASE` | 是 | 用户搜索的基准 DN。系统会在此 DN 下搜索匹配的用户 | `OU=员工,DC=company,DC=com` |
| `LDAP_SEARCH_FILTER` | 是 | LDAP 搜索过滤器。`{username}` 是占位符，会被替换为用户输入的登录名 | AD 用 `(sAMAccountName={username})`，OpenLDAP 用 `(uid={username})` |
| `LDAP_DEFAULT_ROLE` | 否 | LDAP 用户首次登录时自动创建的本地账号角色。可选 `user`（默认）、`admin`、`super_admin` | `user` |

#### 不同 LDAP 服务器的配置参考

**Active Directory（Windows 域控）** — 最常见的企业场景：

```bash
-e LDAP_ENABLED=true
-e LDAP_URL=ldap://ad.company.com:389
-e LDAP_BIND_DN="CN=srv_assetquery,OU=ServiceAccounts,DC=company,DC=com"
-e LDAP_BIND_PASSWORD=P@ssw0rd123!
-e LDAP_SEARCH_BASE="OU=Users,DC=company,DC=com"
-e LDAP_SEARCH_FILTER="(sAMAccountName={username})"
-e LDAP_DEFAULT_ROLE=user
```

> 💡 AD 用户登录名就是 `sAMAccountName`，即 Windows 登录用户名（如 `zhangsan`）。  
> 💡 如需加密传输，将 `ldap://` 改为 `ldaps://`，端口改为 `636`。  
> 💡 `LDAP_BIND_DN` 建议使用专用服务账号，不要用域管理员账号。

**OpenLDAP（开源 LDAP）**：

```bash
-e LDAP_ENABLED=true
-e LDAP_URL=ldap://ldap.company.com:389
-e LDAP_BIND_DN="cn=admin,dc=company,dc=com"
-e LDAP_BIND_PASSWORD=admin_secret
-e LDAP_SEARCH_BASE="ou=people,dc=company,dc=com"
-e LDAP_SEARCH_FILTER="(uid={username})"
-e LDAP_DEFAULT_ROLE=user
```

> 💡 OpenLDAP 通常用 `uid` 字段作为用户名。

**多级部门结构示例**：

如果公司 AD 的组织结构是 `DC=company,DC=com → OU=总部 → OU=技术部 → 用户`，可以将 `LDAP_SEARCH_BASE` 设为更宽泛的 DN 来覆盖所有部门的用户：

```bash
-e LDAP_SEARCH_BASE="OU=总部,DC=company,DC=com"
# 搜索会递归查找所有子 OU 下的用户
```

#### 桥接网络模式（不用 --network host）

如果不想容器直接使用宿主机网络（例如同一台机器上跑多个服务），可以用桥接模式：

```bash
docker run -d \
    --name asset-manager \
    -p 8092:443 \
    -v /opt/asset-manager/data:/app/server/data \
    -e JWT_SECRET=请改为你自己的随机密钥 \
    -e TZ=Asia/Shanghai \
    -e LDAP_ENABLED=true \
    -e LDAP_URL=ldap://192.168.1.10:389 \
    -e LDAP_BIND_DN="CN=ldap_query,OU=服务账号,DC=company,DC=com" \
    -e LDAP_BIND_PASSWORD=YourSecureBindPassword123 \
    -e LDAP_SEARCH_BASE="OU=员工,DC=company,DC=com" \
    -e LDAP_SEARCH_FILTER="(sAMAccountName={username})" \
    -e LDAP_DEFAULT_ROLE=user \
    --restart unless-stopped \
    asset-manager:6.03
```

> 用 `-p 8092:443` 替代了 `--network host`，左边的 8092 是宿主机端口，右边的 443 是容器内默认 HTTPS 端口。  
> ⚠️ 桥接模式下 `/api/health` 接口获取到的客户端 IP 可能是 Docker 网关 IP，审计日志中的 IP 会不准确。如需真实 IP 记录，建议使用 `--network host`。

### 3. Docker Compose

创建 `docker-compose.yml`：

```yaml
version: '3.8'
services:
  asset-manager:
    build: .
    image: asset-manager:6.03
    container_name: asset-manager
    network_mode: host                   # 使用主机网络（推荐，审计日志可获取真实IP）
    volumes:
      # 数据库文件持久化 —— 必须挂载，否则容器重建后数据丢失！
      - ./data:/app/server/data
      # Logo 上传目录持久化（如果配置了企业 Logo）
      - ./uploads:/app/server/data/uploads
    environment:
      # ===== 基础配置 =====
      - JWT_SECRET=9a3f7c2e1b8d4f6e5a0c3b7e9d2f4a1c6b8e0f3a7d5c9b2e6f8a4d1c7e9b3f5
      - TZ=Asia/Shanghai                    # 时区设置，影响审计日志等时间记录
      - PORT=8092                         # HTTPS 访问端口，默认443；host网络模式下会直接占用宿主机端口

      # ===== LDAP 配置（不需要域账号登录则注释掉下面几行）=====
      - LDAP_ENABLED=true                 # true 启用，false（默认）禁用
      - LDAP_URL=ldap://192.168.1.10:389  # LDAP 服务器地址
      - LDAP_BIND_DN=CN=ldap_query,OU=服务账号,DC=company,DC=com  # 绑定DN（有搜索权限的服务账号）
      - LDAP_BIND_PASSWORD=YourSecureBindPassword123               # 绑定账号的密码
      - LDAP_SEARCH_BASE=OU=员工,DC=company,DC=com                  # 搜索基准DN
      - LDAP_SEARCH_FILTER=(sAMAccountName={username})              # 搜索过滤器，AD用sAMAccountName
      - LDAP_DEFAULT_ROLE=user            # LDAP首次登录默认角色: user / admin / super_admin

    restart: unless-stopped
```

```bash
# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down

# 重建镜像（代码更新后）
docker-compose up -d --build
```

### 4. Docker 常用运维命令

```bash
# 查看容器状态
docker ps

# 查看实时日志
docker logs -f asset-manager

# 进入容器内部（排查问题用）
docker exec -it asset-manager sh

# 重启容器（修改环境变量后）
docker restart asset-manager

# 停止并删除容器（数据在挂载卷中不会丢失）
docker stop asset-manager && docker rm asset-manager

# 更新部署（拉取新代码后重新构建）
docker build -t asset-manager:6.03 .
docker stop asset-manager && docker rm asset-manager
docker run -d ...    # 用之前的 docker run 命令重新启动
```

### 5. Dockerfile 说明

项目根目录下的 `Dockerfile` 使用多阶段构建，并在运行阶段内置 Nginx、Node.js、时区配置和自签名 HTTPS 证书生成逻辑。运行脚本位于 `docker/start.sh`。

**Dockerfile 结构说明：**

| 阶段 | 说明 |
|------|------|
| `frontend-builder` | 安装前端依赖并执行 `npm run build`，生成静态文件到 `dist/` |
| `backend-builder` | 安装后端依赖（`server/package.json`），不编译 TypeScript（使用 `tsx` 运行时编译） |
| 运行阶段 | 基于 `node:18-alpine`，安装 Nginx + tzdata + openssl，设置 `TZ=Asia/Shanghai`，复制前端产物和后端代码，启动脚本同时运行 Nginx 和 Node.js |

**自定义 Dockerfile 须知：**
- **时区**：默认 `Asia/Shanghai`（中国标准时间 UTC+8），可通过 `docker run -e TZ=xxx` 覆盖
- **HTTPS**：默认启用自签名 HTTPS，证书保存在 `/app/server/data/certs`，挂载数据目录后会持久化复用
- **端口**：`PORT` 控制 Nginx 对外端口；默认 HTTPS 为 443，设置 `HTTP_ONLY=true` 时默认 HTTP 为 80
- 如需修改 Nginx 配置（如 CORS、缓存等），修改 `/app/start.sh` 中生成 `/etc/nginx/http.d/default.conf` 的逻辑
- `.dockerignore` 已排除 `node_modules`、`dist`、数据目录和压缩包，避免构建上下文过大
- 如需更改 Node.js 版本，修改三处 `FROM node:18-alpine` 中的版本号
- `server/data` 是数据持久化目录，必须在 `docker run` 时用 `-v` 挂载到宿主机

---

## LDAP 域账号登录配置

### 登录流程详解

```
用户输入用户名和密码
         │
         ▼
  ┌─────────────────┐
  │ 尝试本地数据库登录 │
  └────────┬────────┘
           │
     ┌─────┴─────┐
     │           │
  成功 ✓      失败 ✗
     │           │
     ▼           ▼
  返回 Token   LDAP 是否启用？
                 │
           ┌─────┴─────┐
           │           │
         是 ▶️       否 ❌
           │           │
           ▼           ▼
     尝试 LDAP 认证  返回"用户名或密码错误"
           │
     ┌─────┴─────┐
     │           │
  成功 ✓      失败 ✗
     │           │
     ▼           ▼
  用户已存在？   返回"用户名或密码错误"
     │
  ┌──┴──┐
  是    否（首次登录）
  │      │
  │      ▼
  │   自动创建本地用户
  │   角色为 LDAP_DEFAULT_ROLE
  │      │
  └──┬───┘
     │
     ▼
  返回 Token
```

**关键规则**：
- `admin` 账号始终走本地认证，不受 LDAP 影响
- LDAP 认证成功后，每次登录都会同步更新本地用户的密码和显示名
- LDAP 用户首次登录的默认角色由 `LDAP_DEFAULT_ROLE` 控制，管理员可在用户管理中调整

### 如何获取 LDAP 配置参数

如果你不确定公司 LDAP 服务器的参数，可以按以下步骤获取：

1. **LDAP_URL**：联系 IT 管理员获取 LDAP 服务器地址，如 `ldap://ad.yourcompany.com:389`

2. **LDAP_BIND_DN 和 LDAP_BIND_PASSWORD**：需要 IT 管理员创建一个专用的"只读查询"服务账号：
   - AD 示例：`CN=svc_assetquery,OU=Service Accounts,DC=company,DC=com`
   - OpenLDAP 示例：`cn=readonly,dc=company,dc=com`

3. **LDAP_SEARCH_BASE**：你的公司组织在 LDAP 中的位置：
   - AD 通常是：`OU=Users,DC=company,DC=com` 或 `DC=company,DC=com`
   - OpenLDAP 通常是：`ou=people,dc=company,dc=com`

4. **LDAP_SEARCH_FILTER**：
   - **Active Directory**（Windows 域控）用 `(sAMAccountName={username})`
   - **OpenLDAP** 用 `(uid={username})`
   - **其他**请咨询 IT 管理员

5. **验证连接**（可选）：可用 `ldapsearch` 命令行工具测试：

```bash
# 测试 AD 连接（替换各参数为实际值）
ldapsearch -x -H ldap://192.168.1.10:389 \
    -D "CN=ldap_query,OU=ServiceAccounts,DC=company,DC=com" \
    -w "绑定密码" \
    -b "OU=Users,DC=company,DC=com" \
    "(sAMAccountName=zhangsan)"
```

如果返回了用户信息，说明 LDAP 配置参数正确。

---

## 企业信息与 Logo 配置

系统支持在 **系统设置 → 企业信息配置** 中设置：

- **企业名称**：显示在侧边栏顶部和底部，替代默认的"资产管理系统"
- **企业 Logo**：上传图片（支持 PNG/JPEG/GIF/SVG/WebP，最大 2MB），显示在侧边栏顶部

> Logo 图片存储在服务器的 `data/uploads/` 目录下，Docker 部署时数据库目录已挂载则自动持久化。如单独挂载 uploads 目录，需额外添加卷映射。

---

## 数据备份策略

### 自动备份脚本

#### Linux（cron 定时任务）

```bash
cat > /opt/asset-manager/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/asset-manager/backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_FILE="/opt/asset-manager/server/data/asset-manager.db"

mkdir -p $BACKUP_DIR
cp $DB_FILE "$BACKUP_DIR/asset-manager_$DATE.db"

# 保留最近 30 天的备份
find $BACKUP_DIR -name "*.db" -mtime +30 -delete
echo "[$(date)] Backup completed: asset-manager_$DATE.db"
EOF

chmod +x /opt/asset-manager/backup.sh
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/asset-manager/backup.sh >> /opt/asset-manager/backup.log 2>&1") | crontab -
```

#### Docker 部署的备份

```bash
# 方法一：从容器内复制数据库文件
docker cp asset-manager:/app/server/data/asset-manager.db ./backup_$(date +%Y%m%d).db

# 方法二：直接复制宿主机挂载目录中的文件（如果用了 -v 挂载）
cp /opt/asset-manager/data/asset-manager.db ./backup_$(date +%Y%m%d).db
```

### 应用内备份

管理员登录系统后，在 **系统设置 → 数据备份与恢复** 中可一键导出/导入 .db 文件。

> ⚠️ 恢复操作会覆盖当前所有数据，请务必先导出备份再进行恢复！

---

## 重要注意事项

### 1. JWT 密钥安全

- ⚠️ **生产环境必须修改 JWT_SECRET**，不要使用默认值
- 生成方式：`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- 不同部署环境应使用不同的密钥

### 2. 数据库文件保护

- 数据库文件 `data/asset-manager.db` 是所有数据的唯一来源
- Docker 部署时务必挂载数据目录：`-v /宿主机路径:/app/server/data`
- 不挂载卷时，容器删除后数据会丢失！
- Nginx 配置中建议添加 `location ~ /\.db { deny all; }` 禁止直接访问

### 3. HTTPS 配置

Docker 镜像默认启用 HTTPS，并自动生成自签名证书，适合企业内网无公网域名的部署场景。

- 默认访问：`https://服务器IP:PORT`
- 误用 `http://服务器IP:PORT` 访问时，会自动跳转到 `https://服务器IP:PORT`
- 默认端口：未设置 `PORT` 时为 `443`
- 自签名证书路径：`/app/server/data/certs`
- 宿主机持久化路径示例：`/opt/asset-manager/data/certs`
- 浏览器会提示证书“不安全”，接受风险后可继续访问

如果需要使用企业内部 CA 签发的正式证书，可将证书文件覆盖到数据目录中的 `certs/server.crt` 和 `certs/server.key`，然后重启容器。

如果必须退回 HTTP，可启动时增加：

```bash
-e HTTP_ONLY=true
```

### 4. LDAP 安全

- `LDAP_BIND_PASSWORD` 包含敏感信息，确保 `.env` 文件不被版本控制追踪
- Docker 部署时密码以环境变量形式存在于容器中，请确保服务器安全
- 建议对 LDAP 连接使用 LDAPS（LDAP over SSL），即 `LDAP_URL=ldaps://...`，端口使用 `636`
- LDAP 绑定账号建议使用专用的只读服务账号，不要使用域管理员账号
- 建议限制 LDAP 绑定账号的权限为仅可搜索和读取用户基本信息

### 5. 无操作自动登出

- 默认 30 分钟无操作自动登出
- 任何鼠标点击、键盘输入、滚动、触摸操作都会重置计时器
- 如需修改超时时间，修改 `src/App.tsx` 中的 `INACTIVITY_MS` 常量后重新构建

### 6. 端口冲突处理

使用 `--network host` 且访问端口已被占用时：

```bash
# 查看占用 8092 端口的进程
sudo lsof -i :8092     # Linux
netstat -ano | findstr :8092   # Windows

# 方法一：修改系统端口（推荐）
docker run -d --name asset-manager --network host \
    -e PORT=8092 \
    -v /opt/asset-manager/data:/app/server/data \
    -e JWT_SECRET=你的密钥 \
    asset-manager:6.03
# 然后访问 https://服务器IP:8092

# 方法二：停掉占用该端口的服务
sudo systemctl stop nginx   # 如果是 Nginx 占用
```

---

## 部署检查清单

### 基础部署

- [ ] 前端构建成功（`npm run build` 无报错）
- [ ] 后端 `server/.env` 已配置（`JWT_SECRET` 已修改，不再使用默认值）
- [ ] 数据目录已挂载（Docker 的 `-v` 参数或 Nginx 方式的实际路径）
- [ ] 后端健康检查通过：`curl http://localhost:3001/api/health` 返回 `{"code":0}`
- [ ] 浏览器访问 `https://服务器IP:PORT/` 能看到登录页（自签名证书提示“不安全”时选择继续访问）
- [ ] 使用 admin / admin123 能登录
- [ ] 刷新页面不会 404（SPA fallback 验证）

### LDAP 配置（如启用）

- [ ] `LDAP_ENABLED=true` 已设置
- [ ] `LDAP_URL` 指向正确的 LDAP 服务器地址
- [ ] `LDAP_BIND_DN` 和 `LDAP_BIND_PASSWORD` 配置正确（可用 `ldapsearch` 验证）
- [ ] `LDAP_SEARCH_BASE` 和 `LDAP_SEARCH_FILTER` 匹配公司 AD 结构
- [ ] 域账号首次登录可成功并自动创建本地用户
- [ ] 域账号再次登录可正常进入系统

### 功能验证

- [ ] 新增资产时编号自动生成功能正常
- [ ] 资产状态管理页面可正常增删改
- [ ] 编号前缀配置页面可正常增删改
- [ ] 审计日志页面支持按日期、操作类型、用户名筛选
- [ ] 审计日志页面支持页码跳转
- [ ] 资产导出（Excel/CSV）导出的是全部资产而非仅当前页
- [ ] 备份导出/导入正常
- [ ] 系统设置中企业名称和 Logo 配置正常
- [ ] 后端服务已注册为系统服务（systemd / NSSM / Docker restart policy）

### v2.3 安全加固检查

- [ ] `JWT_SECRET` 已修改（不再使用默认 `dev-secret-key`，后端启动日志会警告）
- [ ] Logo 上传仅允许 PNG/JPEG/GIF/WebP（SVG 已禁用，防止 XSS）
- [ ] 批量删除操作限制每次最多 500 条

---

## 更新部署

### 从 v2.2 升级到 v2.3

```bash
# 1. 备份数据库
cp /opt/asset-manager/data/asset-manager.db /opt/asset-manager/data/asset-manager.db.bak

# 2. Docker 部署的更新方式
docker stop asset-manager
docker rm asset-manager

# 3. 重新构建镜像（在项目根目录）
docker build -t asset-manager:6.03 .

# 4. 用之前的 docker run 命令重新启动（记得加上所有 -e 环境变量和 -v 挂载）
docker run -d \
    --name asset-manager \
    --network host \
    -v /opt/asset-manager/data:/app/server/data \
    -e JWT_SECRET=你的密钥 \
    -e TZ=Asia/Shanghai \
    -e PORT=8092 \
    -e LDAP_ENABLED=true \
    -e LDAP_URL=ldap://192.168.1.10:389 \
    -e LDAP_BIND_DN="CN=ldap_query,OU=服务账号,DC=company,DC=com" \
    -e LDAP_BIND_PASSWORD=绑定密码 \
    -e LDAP_SEARCH_BASE="OU=员工,DC=company,DC=com" \
    -e LDAP_SEARCH_FILTER="(sAMAccountName={username})" \
    -e LDAP_DEFAULT_ROLE=user \
    --restart unless-stopped \
    asset-manager:6.03

# 或者用 Docker Compose
docker-compose up -d --build
```

> ⚠️ v2.3 数据库变更：
> - `code_prefixes` 表新增 `suffix`（后缀）和 `number_width`（序号位数）字段，后端启动时自动 `ALTER TABLE` 添加
> - `system_info` 表新增 `audit_log_cleanup_enabled` 和 `audit_log_retention_days` 默认记录
> - 所有变更自动完成，无需手动执行 SQL
>
> ⚠️ v2.3 重要变更：
> - **容器时区**：Dockerfile 已内置 `TZ=Asia/Shanghai`，审计日志等时间记录将显示中国时间。之前版本容器默认 UTC，升级后时间显示正确
> - 如果之前已有数据，旧日志中的时间以 UTC 存储，新日志将以 CST 显示
>
> ⚠️ v6.03 重要变更：
> - Docker 镜像默认启用 HTTPS，访问地址改为 `https://服务器IP:PORT`
> - 首次启动会在数据目录 `certs/` 下生成自签名证书，浏览器会提示“不安全”
> - 如需继续使用 HTTP，启动时添加 `-e HTTP_ONLY=true`

### Nginx 部署的更新方式

```bash
# 1. 备份数据库
cp /opt/asset-manager/server/data/asset-manager.db /opt/asset-manager/server/data/asset-manager.db.bak

# 2. 更新代码后重新构建前端
cd asset-manager
npm install
npm run build

# 3. 更新后端依赖
cd server
npm install

# 4. 部署前端静态文件
cp -r dist/* /usr/share/nginx/asset-manager/

# 5. 重启后端服务
sudo systemctl restart asset-manager
```

---

## 服务器配置建议

### 最低配置

| 项目 | 要求 |
|------|------|
| CPU | 1 核 |
| 内存 | 1 GB |
| 磁盘 | 500 MB |
| Node.js | 18+ LTS |

### 推荐配置（内网 50 人同时使用）

| 项目 | 要求 |
|------|------|
| CPU | 2 核 |
| 内存 | 2 GB |
| 磁盘 | 5 GB |
| 带宽 | 10 Mbps |

---

## 常见问题 FAQ

### Q: Docker 启动后访问页面显示空白？

检查容器日志：`docker logs asset-manager`，确认后端已正常启动。如果访问端口被占用，改用其他端口，例如 `-e PORT=8092`，然后访问 `https://服务器IP:8092`。

### Q: LDAP 登录一直提示"用户名或密码错误"？

1. 先确认 `LDAP_ENABLED=true`
2. 查看容器日志：`docker logs asset-manager | grep LDAP`
3. 用 `ldapsearch` 命令验证连接参数是否正确
4. 确认 `LDAP_SEARCH_FILTER` 与你们的 LDAP 服务器类型匹配（AD 用 `sAMAccountName`，OpenLDAP 用 `uid`）
5. 确认 `LDAP_BIND_DN` 和 `LDAP_BIND_PASSWORD` 正确

### Q: 端口 3001 被占用导致后端启动失败？

```bash
# Linux 查看占用进程
sudo lsof -i :3001
sudo kill -9 $(sudo lsof -t -i :3001)

# Windows 查看占用进程
netstat -ano | findstr :3001
taskkill /PID <进程ID> /F
```

### Q: 数据库备份文件如何恢复？

1. 在系统设置的"数据备份与恢复"中点击"选择备份文件恢复"
2. 或直接替换数据库文件：
   - Docker：`docker cp backup.db asset-manager:/app/server/data/asset-manager.db`
   - Nginx：`cp backup.db /opt/asset-manager/server/data/asset-manager.db`
3. 重启后端服务

### Q: 如何修改 LDAP 用户的角色？

LDAP 用户首次登录后会在本地数据库创建账号，管理员在"用户管理"页面中可以修改其角色（user / admin / super_admin）。

### Q: Docker 部署后 Logo 上传失败？

Logo 上传目录在 `data/uploads/` 下，确保 Docker 数据卷挂载正确。如果只挂载了 `data` 目录，Logo 会自动持久化。如果挂载路径不对，可额外添加：`-v /opt/asset-manager/uploads:/app/server/data/uploads`。

### Q: 导出 Excel 只有当前页的数据？

v2.2 已修复此问题。导出功能现在会从后端获取所有资产数据（不依赖前端分页），确保使用最新版本。

### Q: 系统能支持 5 万条甚至更多资产吗？

可以。SQLite 数据库可轻松处理百万级行数据，5 万条资产毫无压力。所有列表查询都有索引（`asset_code`、`name`、`department`、`status`、`type`）并且采用服务端分页。如需更多资产，请在**系统设置 → 编号前缀配置**中将序号位数从默认的 4 位改为 5 位或 6 位（4位最大9999，5位最大99999，6位最大999999）。

### Q: 审计日志会无限增长吗？

默认不自动清理审计日志。可在**系统设置**中的**审计日志清理**卡片中开启自动清理，设置保留天数（默认365天，最低30天）。开启后系统每天凌晨3点自动清理超过保留天数的日志。推荐开启以避免数据库膨胀。

### Q: 审计日志太多，如何快速查找？

v2.3 审计日志页面已增强筛选功能：
- **按日期范围筛选**：点击"开始日期"和"结束日期"输入框选择日期区间
- **按操作类型筛选**：下拉选择登录、新增资产、删除资产等操作类型
- **按用户名搜索**：在搜索框输入用户名关键字
- **页码跳转**：在分页区域右侧输入页码，按回车直接跳转
- 多个筛选条件可组合使用，点击"重置"按钮清空所有筛选

### Q: 容器内时间不对（显示 UTC 时间）？

v2.3 已修复此问题。Dockerfile 默认设置 `TZ=Asia/Shanghai`，容器启动时会自动配置为中国标准时间（UTC+8）。
- 如需使用其他时区，在 `docker run` 中加 `-e TZ=你的时区` 覆盖
- 验证容器时间：`docker exec asset-manager date`
- 旧版本升级后，之前以 UTC 时间写入的日志仍然显示 UTC 时间，新日志将使用正确时区

默认不自动清理审计日志。可在**系统设置**中的**审计日志清理**卡片中开启自动清理，设置保留天数（默认365天，最低30天）。开启后系统每天凌晨3点自动清理超过保留天数的日志。推荐开启以避免数据库膨胀。

### Q: 编号前缀的后缀和序号位数怎么配？

编号格式为：**前缀 + 后缀 + 序号**。例如：
- 前缀=`MC-IT`、后缀=空、位数=4 → `MC-IT0001`（最大9999）
- 前缀=`MC-IT`、后缀=`-2026-`、位数=5 → `MC-IT-2026-00001`（最大99999）
- 前缀=`ZC`、后缀=空、位数=6 → `ZC000001`（最大999999）

在**系统设置 → 编号前缀配置**中编辑每个部门的前缀，即可设置后缀和序号位数（3-8位）。

### Q: 手动创建的资产编号和自动生成的冲突怎么办？

v2.3 已修复此问题。自动生成编号时会检测 `assets` 表中是否已存在相同的编号，如果冲突会自动跳到下一个未使用的编号。例如已有 `MC-IT003` 时，自动生成会从 `MC-IT003` 开始检测，发现冲突后自动使用 `MC-IT004`。序号用尽时（如4位编号超过9999）会自动回绕到0001，所有编号都用完时会报错提示。

### Q: v2.3 做了哪些安全加固？

- **SVG 上传已禁用**：Logo 上传不再支持 SVG 格式，防止存储型 XSS 攻击
- **登录错误信息不再泄露尝试次数**：统一返回"用户名或密码错误"
- **JWT 密钥缺失告警**：生产环境未设置 `JWT_SECRET` 环境变量时，后端启动日志会输出警告
- **批量删除限制**：单次批量删除最多 500 条，防止恶意大请求
- **JSON 请求体限制**：全局限制 10MB，仅导入接口允许 50MB
- **401 状态同步修复**：Token 过期后前端状态与 localStorage 正确同步，不再卡在已登录界面
- **表单提交失败修复**：新增/编辑资产失败时不再自动关闭对话框，保留用户输入
- **403 / 网络错误提示**：权限不足或网络异常时不再静默失败，会弹出全局错误提示
- **数据库优雅关闭**：收到 SIGINT/SIGTERM 信号时自动保存数据库，防止数据丢失
