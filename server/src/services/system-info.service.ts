import { Database } from '../database/index.js';
import dayjs from 'dayjs';

function getNow(): string { return dayjs().format('YYYY-MM-DD HH:mm:ss'); }

export class SystemInfoService {
  private db: Database;
  constructor(db: Database) { this.db = db; }

  get(key: string): string {
    const row = this.db.get('SELECT value FROM system_info WHERE key = ?', [key]);
    return row ? String(row.value) : '';
  }

  set(key: string, value: string): void {
    const now = getNow();
    const existing = this.db.get('SELECT key FROM system_info WHERE key = ?', [key]);
    if (existing) {
      this.db.run('UPDATE system_info SET value = ?, updated_at = ? WHERE key = ?', [value, now, key]);
    } else {
      this.db.run('INSERT INTO system_info (key, value, updated_at) VALUES (?, ?, ?)', [key, value, now]);
    }
    this.db.scheduleSave();
  }

  getAll(): Record<string, string> {
    const rows = this.db.all('SELECT key, value FROM system_info');
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key as string] = String(row.value);
    }
    return result;
  }
}