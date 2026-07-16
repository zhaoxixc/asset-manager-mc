import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/**
 * 对密码进行哈希
 * @param password 明文密码
 * @returns 哈希后的密码
 */
export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, SALT_ROUNDS);
}

/**
 * 验证密码是否匹配
 * @param password 明文密码
 * @param hash 哈希密码
 * @returns 是否匹配
 */
export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}
