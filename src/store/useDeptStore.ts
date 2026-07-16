import { create } from 'zustand';
import { Department } from '../types';
import api from '../services/api';

/** 部门Store状态 */
interface DeptState {
  /** 部门列表 */
  departments: Department[];
  /** 加载状态 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;

  /** 获取部门列表 */
  fetchDepartments: () => Promise<void>;
  /** 新增部门 */
  addDept: (name: string) => Promise<boolean>;
  /** 更新部门 */
  updateDept: (id: string, name: string) => Promise<boolean>;
  /** 删除部门 */
  deleteDept: (id: string) => Promise<boolean>;
}

/** 部门Store */
const useDeptStore = create<DeptState>()((set, get) => ({
  departments: [],
  loading: false,
  error: null,

  /** 获取部门列表 */
  fetchDepartments: async () => {
    set({ loading: true, error: null });
    try {
      const res = await api.get('/departments');
      set({ departments: res.data.data, loading: false });
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '获取部门列表失败';
      set({ loading: false, error: message });
    }
  },

  /** 新增部门 */
  addDept: async (name: string) => {
    try {
      await api.post('/departments', { name });
      await get().fetchDepartments();
      return true;
    } catch {
      return false;
    }
  },

  /** 更新部门 */
  updateDept: async (id: string, name: string) => {
    try {
      await api.put(`/departments/${id}`, { name });
      await get().fetchDepartments();
      return true;
    } catch {
      return false;
    }
  },

  /** 删除部门 */
  deleteDept: async (id: string) => {
    try {
      await api.delete(`/departments/${id}`);
      await get().fetchDepartments();
      return true;
    } catch {
      return false;
    }
  },
}));

export default useDeptStore;
