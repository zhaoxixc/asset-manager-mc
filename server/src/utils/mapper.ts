/**
 * 将snake_case的数据库行转换为camelCase的对象
 * @param row 数据库行对象
 * @returns camelCase对象
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toCamelCase(row: any): any {
  if (!row || typeof row !== 'object') return row;
  if (Array.isArray(row)) return row.map(toCamelCase);

  const result: Record<string, unknown> = {};
  for (const key of Object.keys(row)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = row[key];
  }
  return result;
}

/**
 * 将camelCase的对象转换为snake_case
 * @param obj camelCase对象
 * @returns snake_case对象
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toSnakeCase(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(toSnakeCase);

  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    result[snakeKey] = obj[key];
  }
  return result;
}
