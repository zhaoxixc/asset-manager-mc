# ---- 前端构建阶段 ----
FROM node:18-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- 后端构建阶段 ----
FROM node:18-alpine AS backend-builder
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ .

# ---- 运行阶段 ----
FROM node:18-alpine
RUN apk add --no-cache nginx tzdata openssl

WORKDIR /app

# 设置默认时区为上海（中国标准时间 UTC+8）
# 可通过 -e TZ=其它时区 覆盖
ENV TZ=Asia/Shanghai

# 复制后端
COPY --from=backend-builder /app/server ./server

# 复制前端构建产物
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# 启动脚本：默认启用 HTTPS，自签名证书保存到数据卷中并复用。
# PORT 控制 Nginx 对外端口；HTTPS 默认 443，HTTP_ONLY=true 时默认 80。
# 后端 API 固定监听 3001；如需修改后端端口，使用 API_PORT 环境变量（不推荐修改）。
COPY docker/start.sh /app/start.sh
RUN chmod +x /app/start.sh

# 数据目录
RUN mkdir -p /app/server/data

EXPOSE 80 443

# 数据持久化：挂载 /app/server/data
VOLUME ["/app/server/data"]

CMD ["/app/start.sh"]
