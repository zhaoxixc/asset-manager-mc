import { create } from 'zustand';
import { Asset, AssetFormData, FilterCondition, ChangeLog, defaultFilter } from '../types';
import api from '../services/api';

/** 资产Store状态 */
interface AssetState {
  /** 资产列表 */
  assets: Asset[];
  /** 变动记录 */
  changeLogs: ChangeLog[];
  /** 总数（分页用） */
  total: number;
  /** 加载状态 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 当前筛选条件 */
  currentFilter: Partial<FilterCondition>;
  /** 当前页码（1-based） */
  currentPage: number;
  /** 当前每页条数 */
  currentPageSize: number;

  /** 获取资产列表 */
  fetchAssets: (filter?: Partial<FilterCondition>, page?: number, pageSize?: number) => Promise<void>;
  /** 获取资产详情 */
  fetchAssetById: (id: string) => Promise<Asset | null>;
  /** 新增资产 */
  addAsset: (data: AssetFormData) => Promise<boolean>;
  /** 更新资产 */
  updateAsset: (id: string, data: AssetFormData) => Promise<boolean>;
  /** 删除单个资产 */
  deleteAsset: (id: string) => Promise<boolean>;
  /** 批量删除资产 */
  batchDeleteAssets: (ids: string[]) => Promise<boolean>;
  /** 导入资产 */
  importAssets: (assets: AssetFormData[]) => Promise<{ success: number; fail: number; errors: string[] }>;
  /** 获取变动记录 */
  fetchChangeLogs: (page?: number, pageSize?: number) => Promise<void>;
}

/** 默认筛选条件（从 types 重新导出） */
export { defaultFilter } from '../types';

/** 资产Store */
const useAssetStore = create<AssetState>()((set, get) => ({
  assets: [],
  changeLogs: [],
  total: 0,
  loading: false,
  error: null,
  currentFilter: {},
  currentPage: 1,
  currentPageSize: 20,

  /** 获取资产列表（服务端分页） */
  fetchAssets: async (filter?: Partial<FilterCondition>, page?: number, pageSize?: number) => {
    const f = filter ?? get().currentFilter;
    const p = page ?? get().currentPage;
    const ps = pageSize ?? get().currentPageSize;
    set({ loading: true, error: null, currentFilter: f, currentPage: p, currentPageSize: ps });
    try {
      const params: Record<string, unknown> = { page: p, pageSize: ps };
      if (f.keyword) params.keyword = f.keyword;
      if (f.type) params.type = f.type;
      if (f.department) params.department = f.department;
      if (f.status) params.status = f.status;
      if (f.location) params.location = f.location;
      if (f.sortBy) params.sortBy = f.sortBy;
      if (f.sortOrder) params.sortOrder = f.sortOrder;

      const res = await api.get('/assets', { params });
      const data = res.data.data;
      set({ assets: data.items, total: data.total, loading: false });
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '获取资产列表失败';
      set({ loading: false, error: message });
    }
  },

  /** 获取资产详情 */
  fetchAssetById: async (id: string) => {
    try {
      const res = await api.get(`/assets/${id}`);
      return res.data.data as Asset;
    } catch {
      return null;
    }
  },

  /** 新增资产 */
  addAsset: async (data: AssetFormData) => {
    try {
      await api.post('/assets', data);
      await get().fetchAssets();
      return true;
    } catch {
      return false;
    }
  },

  /** 更新资产 */
  updateAsset: async (id: string, data: AssetFormData) => {
    try {
      await api.put(`/assets/${id}`, data);
      await get().fetchAssets();
      return true;
    } catch {
      return false;
    }
  },

  /** 删除单条 */
  deleteAsset: async (id: string) => {
    try {
      await api.delete(`/assets/${id}`);
      await get().fetchAssets();
      return true;
    } catch {
      return false;
    }
  },

  /** 批量删除 */
  batchDeleteAssets: async (ids: string[]) => {
    try {
      await api.post('/assets/batch-delete', { ids });
      await get().fetchAssets();
      return true;
    } catch {
      return false;
    }
  },

  /** 导入资产 */
  importAssets: async (dataList: AssetFormData[]) => {
    try {
      const res = await api.post('/assets/import', { assets: dataList });
      await get().fetchAssets();
      return res.data.data as { success: number; fail: number; errors: string[] };
    } catch {
      return { success: 0, fail: dataList.length, errors: ['导入请求失败'] };
    }
  },

  /** 获取变动记录 */
  fetchChangeLogs: async (page = 1, pageSize = 10) => {
    try {
      const res = await api.get('/change-logs', { params: { page, pageSize } });
      const data = res.data.data;
      set({ changeLogs: data.items });
    } catch {
    }
  },
}));

export default useAssetStore;