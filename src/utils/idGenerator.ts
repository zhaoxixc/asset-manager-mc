import dayjs from 'dayjs';
import { Asset } from '../types';

/**
 * 资产编号生成器
 * 格式：ZC-YYYYMMDD-序号（4位）
 * @param existingAssets 已有资产列表，用于确定当天序号
 * @returns 新的资产编号
 */
export const generateAssetCode = (existingAssets: Asset[]): string => {
  const today = dayjs().format('YYYYMMDD');
  const prefix = `ZC-${today}-`;

  // 找出当天已有最大序号
  const todayAssets = existingAssets.filter((a) =>
    a.assetCode.startsWith(prefix),
  );

  let maxSeq = 0;
  todayAssets.forEach((a) => {
    const seqStr = a.assetCode.replace(prefix, '');
    const seq = parseInt(seqStr, 10);
    if (!isNaN(seq) && seq > maxSeq) {
      maxSeq = seq;
    }
  });

  const nextSeq = maxSeq + 1;
  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
};

/**
 * 生成唯一ID
 * @returns UUID格式的唯一ID
 */
export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
};
