import nodemailer from 'nodemailer';
import { Database } from '../database/index.js';

export interface SmtpConfig {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  fromName: string;
}

/** SMTP邮件发送服务（配置存储于system_info表） */
export class MailService {
  private db: Database;
  constructor(db: Database) { this.db = db; }

  getSmtpConfig(): SmtpConfig {
    const get = (key: string): string => {
      const row = this.db.get('SELECT value FROM system_info WHERE key = ?', [key]);
      return (row?.value as string) || '';
    };
    return {
      enabled: get('smtp_enabled') === 'true',
      host: get('smtp_host'),
      port: parseInt(get('smtp_port') || '465', 10) || 465,
      secure: get('smtp_secure') !== 'false',
      user: get('smtp_user'),
      pass: get('smtp_pass'),
      from: get('smtp_from'),
      fromName: get('smtp_from_name'),
    };
  }

  isConfigured(): boolean {
    const c = this.getSmtpConfig();
    return c.enabled && !!c.host && !!c.user;
  }

  /** 发件人：显示名称 + 地址（nodemailer对象格式自动处理编码） */
  private buildFrom(c: SmtpConfig): string | { name: string; address: string } {
    const address = c.from || c.user;
    if (c.fromName) return { name: c.fromName, address };
    return address;
  }

  /** 发送邮件，失败抛出异常 */
  async send(to: string, subject: string, html: string): Promise<void> {
    const c = this.getSmtpConfig();
    if (!c.enabled || !c.host || !c.user) {
      throw new Error('SMTP未配置或未启用，请先在系统设置中配置邮件服务器');
    }
    const transporter = nodemailer.createTransport({
      host: c.host,
      port: c.port,
      secure: c.secure,
      auth: { user: c.user, pass: c.pass },
    });
    await transporter.sendMail({ from: this.buildFrom(c), to, subject, html });
  }
}
