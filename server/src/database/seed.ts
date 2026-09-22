import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { Database } from '../database/index.js';
import dayjs from 'dayjs';

const SALT_ROUNDS = 10;

function getNow(): string { return dayjs().format('YYYY-MM-DD HH:mm:ss'); }

export function seedDatabase(db: Database): void {
  const countRow = db.get('SELECT COUNT(*) as count FROM users');
  const count = (countRow?.count as number) || 0;

  if (count > 0) {
    console.log('[Seed] Users table already has data, skipping seed.');
    return;
  }

  const hashedPassword = bcrypt.hashSync('admin123', SALT_ROUNDS);
  const now = getNow();

  db.run(
    `INSERT INTO users (id, username, password, real_name, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuidv4(), 'admin', hashedPassword, '系统管理员', 'super_admin', 'active', now, now]
  );

  db.run(
    `INSERT INTO users (id, username, password, real_name, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuidv4(), 'qianjie', bcrypt.hashSync('123456', SALT_ROUNDS), 'qianjie', 'admin', 'active', now, now]
  );

  db.run(
    `INSERT INTO users (id, username, password, real_name, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuidv4(), 'qiansy', bcrypt.hashSync('123456', SALT_ROUNDS), 'qiansy', 'user', 'active', now, now]
  );

  const departments = ['研发部', '市场部', '财务部', '人力资源部', '运维部', '行政部'];
  for (const name of departments) {
    db.run('INSERT INTO departments (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)', [uuidv4(), name, now, now]);
  }

  // 插入默认资产类型
  const assetTypeCountRow = db.get('SELECT COUNT(*) as count FROM asset_types');
  const assetTypeCount = (assetTypeCountRow?.count as number) || 0;
  if (assetTypeCount === 0) {
    const defaultTypes = ['IT设备', '办公设备', '网络设备', '其他'];
    for (const name of defaultTypes) {
      db.run('INSERT INTO asset_types (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)', [uuidv4(), name, now, now]);
    }
    console.log('[Seed] Default asset types created.');
  }

  // 插入默认资产状态
  const statusCountRow = db.get('SELECT COUNT(*) as count FROM asset_statuses');
  const statusCount = (statusCountRow?.count as number) || 0;
  if (statusCount === 0) {
    const defaultStatuses = [
      { name: '在用', color: '#34a853' },
      { name: '闲置', color: '#ff6d00' },
      { name: '维修', color: '#9334e6' },
      { name: '损坏', color: '#ea4335' },
      { name: '报废', color: '#9e9e9e' },
    ];
    for (const s of defaultStatuses) {
      db.run('INSERT INTO asset_statuses (id, name, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [uuidv4(), s.name, s.color, now, now]);
    }
    console.log('[Seed] Default asset statuses created.');
  }

  // 插入默认编号前缀配置（按部门）
  const prefixCountRow = db.get('SELECT COUNT(*) as count FROM code_prefixes');
  const prefixCount = (prefixCountRow?.count as number) || 0;
  if (prefixCount === 0) {
    const defaultPrefixes = [
      { department: '研发部', prefix: 'MC-YFB' },
      { department: '市场部', prefix: 'MC-SCB' },
      { department: '财务部', prefix: 'MC-CWB' },
      { department: '人力资源部', prefix: 'MC-HR' },
      { department: '运维部', prefix: 'MC-YWB' },
      { department: '行政部', prefix: 'MC-XZB' },
    ];
    for (const p of defaultPrefixes) {
      db.run('INSERT INTO code_prefixes (id, department, prefix, suffix, number_width, last_seq, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)', [uuidv4(), p.department, p.prefix, '', 4, now, now]);
    }
    console.log('[Seed] Default code prefixes created.');
  }

  db.saveToFile();
  console.log('[Seed] Default users created (admin/admin123, zhangsan/123456, lisi/123456)');
}
