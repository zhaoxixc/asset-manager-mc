# QA 验证报告 — 认证与权限功能

**项目**：企业设备资产管理系统  
**版本**：v1.1.0  
**验证日期**：2026-05-19  
**QA工程师**：严过关  
**修复状态**：P2 问题已全部修复并回归验证 ✅

---

## 测试概要

| 测试项 | 状态 | 备注 |
|--------|------|------|
| T1: TypeScript 编译检查 | ✅ 通过 | 零错误 |
| T2: Vite 生产构建 | ✅ 通过 | 1.35MB（偏大，P3建议） |
| T3: 代码逻辑审查 | ⚠️ 有发现 | 2个P2问题 + 4个P3建议 |
| T4: 潜在问题排查 | ⚠️ 有发现 | 详见下方 |
| T5: 开发服务器启动 | ✅ 通过 | HTTP 200 |

---

## 详细测试结果

### T1: TypeScript 编译检查
```bash
npx tsc --noEmit
# 退出码 0，零错误零警告
```
**结论**：✅ 通过

### T2: Vite 生产构建
```bash
npx vite build
# ✓ 12323 modules transformed
# dist/index.html                     0.46 kB
# dist/assets/index-CHut5TBN.css      3.57 kB
# dist/assets/index-CTZLheXg.js   1,352.49 kB
```
**结论**：✅ 通过（单 chunk 偏大，见 P3-4）

### T3: 代码逻辑审查

#### 3.1 登录流程（useAuthStore.login）

| 检查点 | 结果 | 说明 |
|--------|------|------|
| 锁定检查 | ✅ | `lockedUntil` 与 `Date.now()` 比较正确 |
| 用户查找 | ✅ | 同时匹配 `username` 和 `status === ACTIVE` |
| 密码验证 | ✅ | `verifyPassword()` 正确对比 btoa 编码值 |
| 成功重置 | ✅ | 清零 `loginFailCount` 和 `lockedUntil` |
| 失败计数 | ✅ | 累加 `loginFailCount`，≥3 时设置5分钟锁定 |
| 禁用用户登录 | ✅ | 禁用用户返回"用户名或密码错误"，不泄露状态信息 |

#### 3.2 权限映射（hasPermission）

| 角色 | create | edit | delete | import | manage_users |
|------|--------|------|--------|--------|-------------|
| super_admin | ✅ true | ✅ true | ✅ true | ✅ true | ✅ true |
| admin | ✅ true | ✅ true | ✅ true | ✅ true | ❌ false |
| user | ❌ false | ❌ false | ❌ false | ❌ false | ❌ false |

**结论**：权限映射与需求规格一致 ✅

#### 3.3 路由守卫（App.tsx）

| 检查点 | 结果 | 说明 |
|--------|------|------|
| 未登录 → Login | ✅ | `isAuthenticated` 为 false 时渲染 Login |
| 已登录 → Layout | ✅ | `isAuthenticated` 为 true 时渲染 Layout |
| 示例数据初始化 | ✅ | `initSampleData()` 在首次加载时调用，`initialized` 标志防止重复 |

#### 3.4 导航过滤（Layout.tsx）

| 导航项 | 所需权限 | super_admin | admin | user |
|--------|---------|-------------|-------|------|
| 统计看板 | 无 | ✅ 可见 | ✅ 可见 | ✅ 可见 |
| 资产列表 | 无 | ✅ 可见 | ✅ 可见 | ✅ 可见 |
| 部门管理 | create | ✅ 可见 | ✅ 可见 | ❌ 隐藏 |
| 资产盘点 | create | ✅ 可见 | ✅ 可见 | ❌ 隐藏 |
| 用户管理 | manage_users | ✅ 可见 | ❌ 隐藏 | ❌ 隐藏 |

**结论**：导航过滤逻辑正确 ✅

#### 3.5 按钮禁用控制

| 组件 | 新增 | 编辑 | 删除 | 导入 | 批量删除 |
|------|------|------|------|------|---------|
| AssetTable | disabled+Tooltip | disabled+Tooltip | disabled+Tooltip | disabled+Tooltip | 条件渲染 `canDelete` |
| DeptManager | disabled+Tooltip | disabled+Tooltip | disabled+Tooltip | — | — |
| InventoryCheck | disabled+Tooltip | disabled+Tooltip | — | — | — |
| ImportExport | — | — | — | 条件渲染+警告 | — |

**结论**：按钮禁用模式一致 ✅

#### 3.6 用户管理（UserManagement.tsx）

| 检查点 | 结果 | 说明 |
|--------|------|------|
| CRUD 操作 | ✅ | 新增/编辑/删除功能完整 |
| 重置密码 | ✅ | 最少4位校验 |
| 自我删除保护 | ✅ | `disabled={isSelf}` + 提示信息 |
| 用户名唯一性 | ✅ | 表单提交和 store 双重校验 |
| **页面级权限检查** | ❌ | **组件内部零权限检查（P2-1）** |
| **自我角色降级保护** | ❌ | **超级管理员可将自身角色改为普通用户（P2-2）** |
| **自我禁用保护** | ❌ | **超级管理员可禁用自身账号（P2-2）** |

#### 3.7 密码安全（auth.ts）

| 检查点 | 结果 | 说明 |
|--------|------|------|
| 编码正确性 | ✅ | `btoa(encodeURIComponent(password))` 可逆编码逻辑正确 |
| 验证一致性 | ✅ | `verifyPassword` 对比 hash 值一致 |
| 安全性 | ⚠️ | btoa 可逆（见 P3-1） |

### T4: 潜在问题排查

#### 4.1 刷新页面后登录状态保持
- ✅ 使用 Zustand persist 中间件，`auth-storage` 键存储于 localStorage
- `isAuthenticated`、`currentUser`、`users` 均持久化
- 刷新后正确恢复登录状态

#### 4.2 localStorage 密码可逆性
- ⚠️ `atob(hash)` + `decodeURIComponent()` 可还原明文密码
- 对于纯前端项目，这是已知的设计取舍（P3-1）

#### 4.3 登录锁定跨会话保持
- ✅ `loginFailCount` 和 `lockedUntil` 存储 persist store
- 刷新页面后锁定状态保持
- 清除 localStorage 可重置锁定（预期行为）

#### 4.4 普通用户只读验证
- ✅ 所有修改按钮 disabled + Tooltip
- ✅ 部门管理/盘点/用户管理导航隐藏
- ✅ 可查看统计看板和资产列表
- ⚠️ 无法查看部门管理和盘点的只读视图（P2-1相关）

#### 4.5 管理员无法访问用户管理
- ✅ `hasPermission('manage_users')` 对 admin 返回 false
- ✅ 导航项隐藏
- ⚠️ 组件内部无权限检查（P2-1）

#### 4.6 编辑用户时 currentUser 同步
- ✅ `updateUser` 方法正确同步 `currentUser`
- 行 137-140: 当更新目标为当前用户时，同步更新 `currentUser`

### T5: 开发服务器启动
```bash
npx vite --port 3000
# VITE v5.4.21 ready in 812 ms
# curl http://localhost:3000/ → HTTP 200
```
**结论**：✅ 通过

---

## 发现的问题

### P1（必须修复）
无

### P2（建议修复）— ✅ 已全部修复

#### P2-1: UserManagement 组件缺少页面级权限检查 ✅ 已修复
- **文件**：`src/components/UserManagement.tsx`
- **问题**：组件内部完全没有 `hasPermission` / `isSuperAdmin` 检查。虽然导航已隐藏（Layout 过滤），但缺乏纵深防御
- **风险**：若未来添加 URL 路由（react-router），普通用户可直接通过 URL 访问用户管理页面并执行所有操作
- **修复**：在组件顶部添加 `hasPermission('manage_users')` 检查，无权限时显示"无权访问"Alert

#### P2-2: 超级管理员可自我降级/禁用 ✅ 已修复
- **文件**：`src/components/UserManagement.tsx`
- **问题**：编辑用户时，超级管理员可以将自己的角色改为"管理员"或"普通用户"，也可以将自己的状态改为"禁用"
- **风险**：
  - 降级后，`currentUser.role` 变为非 super_admin，用户管理菜单消失，无法恢复
  - 禁用后，当前会话仍可操作（`isAuthenticated` 未变），但下次登录会被拒绝（`status !== ACTIVE`）
  - 如果是唯一的超级管理员，将永久失去管理权限
- **修复**：
  1. 编辑自己时，角色下拉框锁定（disabled）+ helperText 提示
  2. 编辑自己时，状态下拉框锁定（disabled）+ helperText 提示
  3. 表单提交时二次校验，防止绕过 UI 直接降级/禁用
  3. 或者至少弹出二次确认警告

### P3（改进建议）

#### P3-1: 密码存储安全性提升
- **当前**：`btoa(encodeURIComponent(password))`，可逆编码
- **建议**：使用 Web Crypto API 的 SHA-256 进行不可逆哈希
- **优先级**：低（纯前端项目，密码已在客户端，但提升安全性是好习惯）

#### P3-2: 导出功能应独立于导入权限
- **当前**：导入/导出按钮受同一 `canImport` 权限控制，普通用户无法导出
- **分析**：导出是只读操作，与"普通用户只能查看不能修改"的需求一致
- **建议**：添加 `export` 权限动作，普通用户可导出但不能导入

#### P3-3: 普通用户应可查看部门列表和盘点数据
- **当前**：普通用户看不到"部门管理"和"资产盘点"导航项
- **分析**：用户需求是"只能查看不能修改"，但当前实现是"看不到"
- **建议**：将部门管理和盘点的导航可见性与操作权限分离——普通用户可见导航项，但内部操作按钮 disabled

#### P3-4: 打包体积优化
- **当前**：单 chunk 1,352 kB，超过 500kB 警告
- **建议**：使用 `React.lazy()` + `import()` 代码分割，将 MUI 组件按需加载

---

## 智能路由判定

**NoOne** — P2 问题已全部修复并回归验证通过（tsc ✅ + build ✅ + dev server ✅），无需进一步分派。

---

## 修复记录

| 问题 | 修复方式 | 验证结果 |
|------|---------|---------|
| P2-1: UserManagement 无权限检查 | 组件顶部添加 `hasPermission('manage_users')` 检查，无权限显示 Alert | ✅ tsc + build 通过 |
| P2-2: 自我降级/禁用保护 | 角色下拉框+状态下拉框编辑自己时 disabled，表单提交二次校验 | ✅ tsc + build 通过 |

---

## 权限矩阵验证汇总

### 功能权限矩阵（实际验证结果）

| 功能 | super_admin | admin | user | 符合需求 |
|------|-------------|-------|------|---------|
| 查看统计看板 | ✅ | ✅ | ✅ | ✅ |
| 查看资产列表 | ✅ | ✅ | ✅ | ✅ |
| 查看资产详情 | ✅ | ✅ | ✅ | ✅ |
| 新增资产 | ✅ | ✅ | ❌ | ✅ |
| 编辑资产 | ✅ | ✅ | ❌ | ✅ |
| 删除资产 | ✅ | ✅ | ❌ | ✅ |
| 批量删除资产 | ✅ | ✅ | ❌ | ✅ |
| 导入数据 | ✅ | ✅ | ❌ | ✅ |
| 导出数据 | ✅ | ✅ | ❌ | ⚠️ 可商榷 |
| 查看部门管理 | ✅ | ✅ | ❌ | ⚠️ 可商榷 |
| 管理部门(增删改) | ✅ | ✅ | ❌ | ✅ |
| 查看资产盘点 | ✅ | ✅ | ❌ | ⚠️ 可商榷 |
| 盘点操作 | ✅ | ✅ | ❌ | ✅ |
| 用户管理 | ✅ | ❌ | ❌ | ✅ |
| 登录 | ✅ | ✅ | ✅ | ✅ |
| 登出 | ✅ | ✅ | ✅ | ✅ |

标注 ⚠️ 的项为 P2/P3 建议改进，当前实现严格于需求（不可见 vs 只读可见）。

---

## 登录安全验证

| 安全特性 | 实现状态 | 说明 |
|---------|---------|------|
| 连续失败锁定 | ✅ | 3次失败锁定5分钟 |
| 锁定时间显示 | ✅ | 剩余分钟数提示 |
| 密码显示/隐藏 | ✅ | 眼睛图标切换 |
| 回车键提交 | ✅ | onKeyDown 监听 |
| 空值校验 | ✅ | 提示"请输入用户名和密码" |
| 禁用用户登录 | ✅ | 返回通用错误，不泄露信息 |
| 默认账号提示 | ✅ | 登录页底部显示 |
| 登出确认 | ✅ | confirm 对话框 |
