docker run -d \
  --name asset-manager-v6.05 \
  --network host \
  -v /opt/asset-manager/data:/app/server/data \
  -e JWT_SECRET=***REMOVED*** \
  -e PORT=8092 \
  --restart unless-stopped \
  docker.io/library/asset-manager:6.05
