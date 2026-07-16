import { Asset, AssetType, AssetStatus, Department, ChangeLog } from '../types';
import { generateId } from './idGenerator';
import dayjs from 'dayjs';

/** 预置部门 */
export const defaultDepartments: Department[] = [
  { id: generateId(), name: '研发部', createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss') },
  { id: generateId(), name: '市场部', createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss') },
  { id: generateId(), name: '财务部', createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss') },
  { id: generateId(), name: '人力资源部', createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss') },
  { id: generateId(), name: '运维部', createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss') },
  { id: generateId(), name: '行政部', createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss') },
];

/** 生成示例资产数据 */
const createSampleAssets = (): Asset[] => {
  const baseDate = dayjs().format('YYYYMMDD');
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const deptNames = ['研发部', '市场部', '财务部', '人力资源部', '运维部', '行政部'];

  const rawAssets: Omit<Asset, 'id' | 'assetCode' | 'createdAt' | 'updatedAt'>[] = [
    { name: 'MacBook Pro 16寸', type: AssetType.IT_DEVICE, model: 'Apple M2 Max', department: '研发部', user: '张伟', purchaseDate: '2024-01-15', status: AssetStatus.IN_USE, location: 'A栋3层301', remark: '高级开发人员专用' },
    { name: 'ThinkPad X1 Carbon', type: AssetType.IT_DEVICE, model: 'Gen 11', department: '研发部', user: '李明', purchaseDate: '2024-02-20', status: AssetStatus.IN_USE, location: 'A栋3层302', remark: '' },
    { name: 'Dell U2723QE显示器', type: AssetType.IT_DEVICE, model: '27寸4K', department: '研发部', user: '张伟', purchaseDate: '2024-01-15', status: AssetStatus.IN_USE, location: 'A栋3层301', remark: '配套MacBook使用' },
    { name: 'HP LaserJet打印机', type: AssetType.OFFICE_DEVICE, model: 'M404dn', department: '财务部', user: '王芳', purchaseDate: '2023-06-10', status: AssetStatus.IN_USE, location: 'B栋2层201', remark: '财务专用打印机' },
    { name: '佳能复印机', type: AssetType.OFFICE_DEVICE, model: 'iR C3226', department: '行政部', user: '赵静', purchaseDate: '2023-03-22', status: AssetStatus.IN_USE, location: 'B栋1层大厅', remark: '公共复印机' },
    { name: '华为交换机', type: AssetType.NETWORK_DEVICE, model: 'S5735-L48T4X', department: '运维部', user: '刘强', purchaseDate: '2023-09-05', status: AssetStatus.IN_USE, location: 'C栋机房', remark: '核心交换机' },
    { name: 'Cisco路由器', type: AssetType.NETWORK_DEVICE, model: 'C9200-24T', department: '运维部', user: '刘强', purchaseDate: '2023-09-05', status: AssetStatus.IN_USE, location: 'C栋机房', remark: '出口路由器' },
    { name: '联想台式机', type: AssetType.IT_DEVICE, model: 'ThinkCentre M930t', department: '市场部', user: '陈雪', purchaseDate: '2023-11-18', status: AssetStatus.IN_USE, location: 'A栋2层205', remark: '' },
    { name: 'iPad Pro', type: AssetType.IT_DEVICE, model: '12.9寸 M2', department: '市场部', user: '周丽', purchaseDate: '2024-03-01', status: AssetStatus.IN_USE, location: 'A栋2层206', remark: '市场展示用' },
    { name: '投影仪', type: AssetType.OFFICE_DEVICE, model: 'Epson CB-FH52', department: '行政部', user: '赵静', purchaseDate: '2023-05-12', status: AssetStatus.IDLE, location: 'B栋1层会议室', remark: '暂时闲置' },
    { name: '旧款台式机', type: AssetType.IT_DEVICE, model: 'Dell OptiPlex 3050', department: '人力资源部', user: '', purchaseDate: '2021-08-20', status: AssetStatus.IDLE, location: '仓库A区', remark: '已淘汰待分配' },
    { name: '华为防火墙', type: AssetType.NETWORK_DEVICE, model: 'USG6500E', department: '运维部', user: '孙磊', purchaseDate: '2023-10-15', status: AssetStatus.REPAIR, location: 'C栋机房', remark: '硬件故障送修中' },
    { name: '碎纸机', type: AssetType.OFFICE_DEVICE, model: '科密C-838D', department: '财务部', user: '王芳', purchaseDate: '2022-04-08', status: AssetStatus.SCRAPPED, location: '仓库B区', remark: '已报废' },
    { name: 'Surface Pro 9', type: AssetType.IT_DEVICE, model: 'i7/16G/256G', department: '研发部', user: '吴鹏', purchaseDate: '2024-04-10', status: AssetStatus.IN_USE, location: 'A栋3层305', remark: '前端开发' },
    { name: '无线AP', type: AssetType.NETWORK_DEVICE, model: '华为AP7060DN', department: '运维部', user: '孙磊', purchaseDate: '2023-07-20', status: AssetStatus.IN_USE, location: 'A栋2层', remark: '2层无线覆盖' },
    { name: '会议室视频终端', type: AssetType.OTHER, model: 'Polycom RealPresence', department: '行政部', user: '赵静', purchaseDate: '2023-01-15', status: AssetStatus.IN_USE, location: 'B栋1层会议室', remark: '视频会议系统' },
    { name: '旧款笔记本', type: AssetType.IT_DEVICE, model: 'Lenovo T480', department: '人力资源部', user: '钱敏', purchaseDate: '2020-06-30', status: AssetStatus.SCRAPPED, location: '仓库B区', remark: '超过使用年限' },
    { name: '网络硬盘录像机', type: AssetType.NETWORK_DEVICE, model: '海康DS-7916N-K4', department: '运维部', user: '刘强', purchaseDate: '2023-08-25', status: AssetStatus.IN_USE, location: 'C栋机房', remark: '监控系统' },
  ];

  return rawAssets.map((item, index) => ({
    ...item,
    id: generateId(),
    assetCode: `ZC-${baseDate}-${String(index + 1).padStart(4, '0')}`,
    createdAt: now,
    updatedAt: now,
  }));
};

/** 示例变动记录 */
export const createSampleChangeLogs = (assets: Asset[]): ChangeLog[] => {
  const now = dayjs();
  return [
    {
      id: generateId(),
      assetCode: assets[0]?.assetCode || '',
      assetName: assets[0]?.name || '',
      action: '新增',
      detail: '新增资产',
      createdAt: now.subtract(1, 'hour').format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      id: generateId(),
      assetCode: assets[5]?.assetCode || '',
      assetName: assets[5]?.name || '',
      action: '状态变更',
      detail: '状态从"在用"变为"维修"',
      createdAt: now.subtract(3, 'hour').format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      id: generateId(),
      assetCode: assets[9]?.assetCode || '',
      assetName: assets[9]?.name || '',
      action: '状态变更',
      detail: '状态从"在用"变为"闲置"',
      createdAt: now.subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      id: generateId(),
      assetCode: assets[12]?.assetCode || '',
      assetName: assets[12]?.name || '',
      action: '状态变更',
      detail: '状态从"维修"变为"报废"',
      createdAt: now.subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      id: generateId(),
      assetCode: assets[13]?.assetCode || '',
      assetName: assets[13]?.name || '',
      action: '新增',
      detail: '新增资产',
      createdAt: now.subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss'),
    },
  ];
};

/** 获取示例资产 */
export const getSampleAssets = createSampleAssets;
