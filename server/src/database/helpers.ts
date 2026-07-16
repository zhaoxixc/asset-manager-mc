import { Database as SqlJsDatabase, BindParams } from 'sql.js';

/**
 * sql.js 数据库辅助函数
 * 提供类似 better-sqlite3 的便捷API
 */

/** 执行查询并返回所有行（对象格式） */
export function all(db: SqlJsDatabase, sql: string, params: unknown[] = []): Record<string, unknown>[] {
  const stmt = db.prepare(sql);
  stmt.bind(params as BindParams);

  const results: Record<string, unknown>[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

/** 执行查询并返回第一行（对象格式） */
export function get(db: SqlJsDatabase, sql: string, params: unknown[] = []): Record<string, unknown> | undefined {
  const stmt = db.prepare(sql);
  stmt.bind(params as BindParams);

  let result: Record<string, unknown> | undefined;
  if (stmt.step()) {
    result = stmt.getAsObject();
  }
  stmt.free();
  return result;
}

/** 执行写操作（INSERT/UPDATE/DELETE）并返回影响信息 */
export function run(db: SqlJsDatabase, sql: string, params: unknown[] = []): void {
  db.run(sql, params as BindParams);
}

/** 获取最近INSERT的自增ID */
export function getLastInsertId(db: SqlJsDatabase): number {
  const result = db.exec('SELECT last_insert_rowid() as id');
  return result[0]?.values[0]?.[0] as number || 0;
}
