import dotenv from 'dotenv';
import { config } from './config/index.js';
import { Database } from './database/index.js';
import { seedDatabase } from './database/seed.js';
import { createApp } from './app.js';

/** 应用启动入口 */
async function main(): Promise<void> {
  // 加载环境变量
  dotenv.config();

  // 初始化数据库
  const db = Database.getInstance(config.dbPath);
  await db.initialize();

  // 运行种子数据
  seedDatabase(db);

  // 创建Express应用
  const app = createApp(db);

  // 启动服务
  app.listen(config.port, () => {
    console.log(`[Asset Manager] Server running on http://localhost:${config.port}`);
    console.log(`[Asset Manager] Database: ${config.dbPath}`);
    console.log(`[Asset Manager] Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

main().catch((err) => {
  console.error('[Asset Manager] Failed to start server:', err);
  process.exit(1);
});
