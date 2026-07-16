import initSqlJs, { Database as SqlJsDatabase, BindParams } from 'sql.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Graceful shutdown handler declarations (setup after Database class)
let _gracefulShutdown: (() => void) | null = null;
const setupGracefulShutdown = () => {
  if (_gracefulShutdown) return;
  _gracefulShutdown = () => {
    const instance = Database.getInstance();
    if (instance) {
      try {
        instance.saveToFile();
        console.log('[Database] Graceful shutdown: data saved.');
      } catch { /* ignore */ }
    }
    process.exit(0);
  };
  process.on('SIGINT', _gracefulShutdown);
  process.on('SIGTERM', _gracefulShutdown);
};

/**
 * 数据库单例管理类
 * 使用 sql.js (WASM-based SQLite)，提供类似 better-sqlite3 的API
 */
export class Database {
  private static instance: Database | null = null;
  private db: SqlJsDatabase | null = null;
  private dbPath: string;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  private constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  static getInstance(dbPath?: string): Database {
    if (!Database.instance) {
      if (!dbPath) throw new Error('Database path is required for first initialization');
      Database.instance = new Database(dbPath);
    }
    return Database.instance;
  }

  async initialize(): Promise<void> {
    const dir = dirname(this.dbPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const SQL = await initSqlJs();

    if (existsSync(this.dbPath)) {
      const buffer = readFileSync(this.dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }

    const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
    this.db.run(schema);
    this.runMigrations();
    this.saveToFile();
    setupGracefulShutdown();
    console.log('[Database] Initialized successfully at:', this.dbPath);
  }

  getDb(): SqlJsDatabase {
    if (!this.db) throw new Error('Database not initialized. Call initialize() first.');
    return this.db;
  }

  saveToFile(): void {
    if (!this.db) return;
    try {
      const data = this.db.export();
      writeFileSync(this.dbPath, Buffer.from(data));
    } catch (err) {
      console.error('[Database] Failed to save:', err);
    }
  }

  scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveToFile();
      this.saveTimer = null;
    }, 500);
  }

  async reinitialize(newPath?: string): Promise<void> {
    if (this.db) this.db.close();
    if (newPath) this.dbPath = newPath;
    this.db = null;
    await this.initialize();
  }

  /**
   * 从Buffer重新初始化数据库（用于备份恢复）
   * 先将buffer写入dbPath文件，再重新从文件加载
   */
  async reinitializeFromBuffer(buffer: Buffer): Promise<void> {
    if (this.db) this.db.close();
    this.db = null;
    const backupPath = this.dbPath + '.bak';
    try {
      if (existsSync(this.dbPath)) {
        const existing = readFileSync(this.dbPath);
        writeFileSync(backupPath, existing);
      }
      writeFileSync(this.dbPath, buffer);
    } catch {
      if (existsSync(backupPath)) {
        writeFileSync(this.dbPath, readFileSync(backupPath));
      }
      throw new Error('Failed to write backup, original file restored');
    }
    try {
      await this.initialize();
    } catch {
      if (existsSync(backupPath)) {
        writeFileSync(this.dbPath, readFileSync(backupPath));
      }
      throw new Error('Failed to initialize from backup buffer');
    }
  }

  close(): void {
    if (this.db) {
      this.saveToFile();
      this.db.close();
      this.db = null;
    }
  }

  /**
   * 数据库迁移：为已存在的数据库添加新字段
   * 使用 ALTER TABLE ... ADD COLUMN（IF NOT EXISTS 模式），确保升级兼容
   */
  private runMigrations(): void {
    const db = this.getDb();
    const migrations = [
      { table: 'code_prefixes', column: 'suffix', definition: "TEXT NOT NULL DEFAULT ''" },
      { table: 'code_prefixes', column: 'number_width', definition: 'INTEGER NOT NULL DEFAULT 4' },
      { table: 'assets', column: 'wired_macs', definition: "TEXT NOT NULL DEFAULT '[]'" },
      { table: 'assets', column: 'wireless_macs', definition: "TEXT NOT NULL DEFAULT '[]'" },
      { table: 'assets', column: 'hostnames', definition: "TEXT NOT NULL DEFAULT '[]'" },
    ];
    for (const m of migrations) {
      try {
        const colCheck = db.exec(`PRAGMA table_info(${m.table})`);
        const columns = colCheck[0]?.values?.map((row) => row[1]) || [];
        if (!columns.includes(m.column)) {
          db.run(`ALTER TABLE ${m.table} ADD COLUMN ${m.column} ${m.definition}`);
          console.log(`[Migration] Added column ${m.column} to ${m.table}`);
        }
      } catch (err) {
        console.error(`[Migration] Error adding column ${m.column} to ${m.table}:`, err);
      }
    }
    // 确保 system_info 默认数据存在
    const infoDefaults = [
      { key: 'company_name', value: '' },
      { key: 'company_logo', value: '' },
      { key: 'audit_log_cleanup_enabled', value: 'false' },
      { key: 'audit_log_retention_days', value: '365' },
    ];
    for (const d of infoDefaults) {
      try {
        const existing = this.get('SELECT value FROM system_info WHERE key = ?', [d.key]);
        if (!existing) {
          this.run("INSERT INTO system_info (key, value, updated_at) VALUES (?, ?, datetime('now', 'localtime'))", [d.key, d.value]);
          console.log(`[Migration] Added system_info default: ${d.key}`);
        }
      } catch {
        // system_info table might not exist yet, schema.sql will handle it
      }
    }
  }

  // ========== Query Helpers ==========

  /** 执行写操作 */
  run(sql: string, params: unknown[] = []): void {
    this.getDb().run(sql, params as BindParams);
  }

  /** 查询单行 */
  get(sql: string, params: unknown[] = []): Record<string, unknown> | undefined {
    const db = this.getDb();
    const stmt = db.prepare(sql);
    stmt.bind(params as BindParams);
    let result: Record<string, unknown> | undefined;
    if (stmt.step()) result = stmt.getAsObject();
    stmt.free();
    return result;
  }

  /** 查询多行 */
  all(sql: string, params: unknown[] = []): Record<string, unknown>[] {
    const db = this.getDb();
    const stmt = db.prepare(sql);
    stmt.bind(params as BindParams);
    const results: Record<string, unknown>[] = [];
    while (stmt.step()) results.push(stmt.getAsObject());
    stmt.free();
    return results;
  }

  /** 事务执行 */
  transaction(fn: () => void): void {
    const db = this.getDb();
    db.run('BEGIN TRANSACTION');
    try {
      fn();
      db.run('COMMIT');
    } catch (err) {
      db.run('ROLLBACK');
      throw err;
    }
    this.scheduleSave();
  }
}
