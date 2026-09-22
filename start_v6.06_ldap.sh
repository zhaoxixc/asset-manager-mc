docker run -d \
  --name asset-manager-v6.06 \
  --network host \
  -v /opt/asset-manager/data:/app/server/data \
  --env-file /root/proj/tools/asset-manager-mc/v6.05/server/.env \
  -e JWT_SECRET=***REMOVED*** \
  -e PORT=8092 \
  --restart unless-stopped \
  asset-manager:6.06
