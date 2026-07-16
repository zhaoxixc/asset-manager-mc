import ldap from 'ldapjs';
import { config } from '../config/index.js';

export class LdapService {
  private url: string;
  private bindDN: string;
  private bindPassword: string;
  private searchBase: string;
  private searchFilter: string;

  constructor() {
    this.url = config.ldap.url;
    this.bindDN = config.ldap.bindDN;
    this.bindPassword = config.ldap.bindPassword;
    this.searchBase = config.ldap.searchBase;
    this.searchFilter = config.ldap.searchFilter;
  }

  /**
   * 验证LDAP用户登录
   * @param username 用户名（uid或sAMAccountName）
   * @param password 密码
   * @returns 验证成功返回用户信息，失败返回null
   */
  async authenticate(username: string, password: string): Promise<{ dn: string; displayName: string; email: string } | null> {
    return new Promise((resolve) => {
      const client = ldap.createClient({ url: this.url });

      client.on('error', (err) => {
        console.error('[LDAP] Connection error:', err.message);
        client.destroy();
        resolve(null);
      });

      // Step 1: 用管理员DN绑定搜索用户
      client.bind(this.bindDN, this.bindPassword, (bindErr) => {
        if (bindErr) {
          console.error('[LDAP] Admin bind failed:', bindErr.message);
          client.destroy();
          resolve(null);
          return;
        }

        // Step 2: 搜索用户DN
        const filter = this.searchFilter.replace('{username}', username);
        const searchOpts: ldap.SearchOptions = {
          filter,
          scope: 'sub',
          attributes: ['dn', 'displayName', 'cn', 'sn', 'uid', 'sAMAccountName', 'mail', 'email'],
        };

        client.search(this.searchBase, searchOpts, (searchErr, searchRes) => {
          if (searchErr) {
            console.error('[LDAP] Search error:', searchErr.message);
            client.destroy();
            resolve(null);
            return;
          }

          const entries: ldap.SearchEntry[] = [];

          searchRes.on('searchEntry', (entry) => {
            entries.push(entry);
          });

          searchRes.on('error', (err) => {
            console.error('[LDAP] Search result error:', err.message);
            client.destroy();
            resolve(null);
          });

          searchRes.on('end', () => {
            if (entries.length === 0) {
              client.destroy();
              resolve(null);
              return;
            }

            const userEntry = entries[0];
            const userDN = userEntry.dn;

            // Extract display name
            const getAttr = (name: string): string => {
              const attr = userEntry.attributes.find((a) => a.type === name);
              return attr && attr.vals && attr.vals.length > 0 ? attr.vals[0] : '';
            };

            const displayName = getAttr('displayName') || getAttr('cn') || username;
            const email = getAttr('mail') || getAttr('email') || '';

            // Step 3: 用用户DN+密码验证
            client.bind(userDN, password, (userBindErr) => {
              client.destroy();
              if (userBindErr) {
                console.error('[LDAP] User bind failed (wrong password?):', userBindErr.message);
                resolve(null);
                return;
              }

              resolve({ dn: userDN, displayName, email });
            });
          });
        });
      });
    });
  }
}