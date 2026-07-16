import { PaginatedResult } from '../types/index.js';

/**
 * 成功响应
 * @param data 响应数据
 * @param message 响应消息
 */
export function success<T>(data: T, message: string = 'success'): { code: number; message: string; data: T } {
  return { code: 0, message, data };
}

/**
 * 错误响应
 * @param code 错误码
 * @param message 错误消息
 */
export function error(code: number, message: string): { code: number; message: string; data: null } {
  return { code, message, data: null };
}

/**
 * 分页响应
 * @param items 当前页数据
 * @param total 总记录数
 * @param page 当前页码
 * @param pageSize 每页条数
 */
export function paginate<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number
): { code: number; message: string; data: PaginatedResult<T> } {
  return {
    code: 0,
    message: 'success',
    data: { items, total, page, pageSize },
  };
}
