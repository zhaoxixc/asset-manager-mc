import ldap from 'ldapjs';
import { config } from '../config/index.js';

export class LdapService {
  private url: string;
  private bindDN: string;
  private bindPassword: string;
  /** 搜索基址列表：LDAP_SEARCH_BASE 支持 | 或 ; 分隔多个DN（DN本身含逗号，不能用逗号分隔） */
  private searchBases: string[];
  private searchFilter: string;

  constructor() {
    this.url = config.ldap.url;
    this.bindDN = config.ldap.bindDN;
    this.bindPassword = config.ldap.bindPassword;
    this.searchBases = config.ldap.searchBase.split(/[|;]/).map((s) => s.trim()).filter(Boolean);
    this.searchFilter = config.ldap.searchFilter;
  }

  private createClient(): ldap.Client {
    return ldap.createClient({ url: this.url });
  }

  private bindAdmin(client: ldap.Client): Promise<void> {
    return new Promise((resolve, reject) => {
      client.bind(this.bindDN, this.bindPassword, (err) => (err ? reject(err) : resolve()));
    });
  }

  /** 在单个基址下搜索（sub范围，分页规避服务端条数限制） */
  private searchEntries(client: ldap.Client, base: string, filter: string): Promise<ldap.SearchEntry[]> {
    return new Promise((resolve, reject) => {
      const opts: ldap.SearchOptions = {
        filter,
        scope: 'sub',
        paged: { pageSize: 200 },
        attributes: ['dn', 'displayName', 'cn', 'sn', 'uid', 'sAMAccountName', 'mail', 'email'],
      };
      client.search(base, opts, (err, res) => {
        if (err) { reject(err); return; }
        const entries: ldap.SearchEntry[] = [];
        res.on('searchEntry', (e) => entries.push(e));
        res.on('error', (e) => reject(e));
        res.on('end', () => resolve(entries));
      });
    });
  }

  private getAttr(entry: ldap.SearchEntry, name: string): string {
    const attr = entry.attributes.find((a) => a.type === name);
    return attr && attr.vals && attr.vals.length > 0 ? attr.vals[0] : '';
  }

  /**
   * 拉取LDAP中的全部用户（用于管理员手动同步）
   * 依次搜索所有基址，按DN去重合并
   */
  async listUsers(): Promise<{ uid: string; displayName: string; email: string }[]> {
    let client: ldap.Client | null = null;
    try {
      client = this.createClient();
      await this.bindAdmin(client);
      const filter = this.searchFilter.replace('{username}', '*');
      const bindUid = /(?:^|,)uid=([^,]+)/i.exec(this.bindDN)?.[1] || '';
      const seen = new Set<string>();
      const users: { uid: string; displayName: string; email: string }[] = [];
      for (const base of this.searchBases) {
        try {
          const entries = await this.searchEntries(client, base, filter);
          for (const entry of entries) {
            if (seen.has(entry.dn)) continue;
            seen.add(entry.dn);
            const uid = this.getAttr(entry, 'uid') || this.getAttr(entry, 'sAMAccountName');
            if (!uid || uid === bindUid) continue;
            users.push({
              uid,
              displayName: this.getAttr(entry, 'displayName') || this.getAttr(entry, 'cn') || uid,
              email: this.getAttr(entry, 'mail') || this.getAttr(entry, 'email') || '',
            });
          }
        } catch (err) {
          console.error(`[LDAP] Search error on base "${base}":`, (err as Error).message);
        }
      }
      return users;
    } catch (err) {
      console.error('[LDAP] listUsers failed:', (err as Error).message);
      return [];
    } finally {
      client?.destroy();
    }
  }

  /**
   * 验证LDAP用户登录
   * 依次在所有基址中搜索用户，找到后用用户DN+密码验证
   * @param username 用户名（uid或sAMAccountName）
   * @param password 密码
   * @returns 验证成功返回用户信息，失败返回null
   */
  async authenticate(username: string, password: string): Promise<{ dn: string; displayName: string; email: string } | null> {
    let client: ldap.Client | null = null;
    try {
      client = this.createClient();
      await this.bindAdmin(client);

      // 在所有基址中查找用户（找到即停）
      const filter = this.searchFilter.replace('{username}', username);
      let entry: ldap.SearchEntry | null = null;
      for (const base of this.searchBases) {
        const found = await this.searchEntries(client, base, filter);
        if (found.length > 0) { entry = found[0]; break; }
      }
      if (!entry) return null;

      const displayName = this.getAttr(entry, 'displayName') || this.getAttr(entry, 'cn') || username;
      const email = this.getAttr(entry, 'mail') || this.getAttr(entry, 'email') || '';

      // 用用户DN+密码验证
      const userBindOk = await new Promise<boolean>((resolve) => {
        client!.bind(entry!.dn, password, (err) => resolve(!err));
      });
      if (!userBindOk) {
        console.error('[LDAP] User bind failed (wrong password?)');
        return null;
      }
      return { dn: entry.dn, displayName, email };
    } catch (err) {
      console.error('[LDAP] Authentication error:', (err as Error).message);
      return null;
    } finally {
      client?.destroy();
    }
  }
}
