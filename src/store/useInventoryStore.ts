import { create } from 'zustand';
import { InventoryTask, InventoryStatus } from '../types';
import api from '../services/api';

/** 盘点Store状态 */
interface InventoryState {
  /** 盘点任务列表 */
  tasks: InventoryTask[];
  /** 加载状态 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;

  /** 获取盘点任务列表 */
  fetchTasks: () => Promise<void>;
  /** 创建盘点任务 */
  createTask: (name: string, department: string) => Promise<boolean>;
  /** 更新盘点记录状态 */
  updateRecordStatus: (
    taskId: string,
    recordId: string,
    status: InventoryStatus,
    remark: string,
  ) => Promise<boolean>;
  /** 删除盘点任务 */
  deleteTask: (id: string) => Promise<boolean>;
}

/** 盘点Store */
const useInventoryStore = create<InventoryState>()((set, get) => ({
  tasks: [],
  loading: false,
  error: null,

  /** 获取盘点任务列表 */
  fetchTasks: async () => {
    set({ loading: true, error: null });
    try {
      const res = await api.get('/inventory/tasks');
      set({ tasks: res.data.data, loading: false });
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '获取盘点任务失败';
      set({ loading: false, error: message });
    }
  },

  /** 创建盘点任务 */
  createTask: async (name: string, department: string) => {
    try {
      await api.post('/inventory/tasks', { name, department });
      await get().fetchTasks();
      return true;
    } catch {
      return false;
    }
  },

  /** 更新盘点记录状态 */
  updateRecordStatus: async (taskId: string, recordId: string, status: InventoryStatus, remark: string) => {
    try {
      await api.put(`/inventory/tasks/${taskId}/records/${recordId}`, { status, remark });
      await get().fetchTasks();
      return true;
    } catch {
      return false;
    }
  },

  /** 删除盘点任务 */
  deleteTask: async (id: string) => {
    try {
      await api.delete('/inventory/tasks/' + id);
      await get().fetchTasks();
      return true;
    } catch {
      return false;
    }
  },
}));

export default useInventoryStore;
