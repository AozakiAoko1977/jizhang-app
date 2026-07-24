/**
 * preload/index.ts — Electron 预加载脚本（安全桥接层）
 * ============================================================
 *
 * 这个文件是 Electron 应用中最重要的安全边界。
 *
 * 通俗理解：它就像银行柜台的"防弹玻璃"——
 *   前端（渲染进程）不能直接碰 Node.js 和数据库，
 *   只能通过 preload 暴露的有限 API 来间接访问。
 *   这样就防止了恶意代码（如 XSS 攻击）直接控制系统。
 *
 * 工作原理：
 *   contextBridge.exposeInMainWorld('api', {...})
 *   把后端能力包装成一个 window.api 对象暴露给前端。
 *   前端只能调用这些指定的方法，无法越权访问 Node.js 或文件系统。
 *
 *   每个方法内部通过 ipcRenderer.invoke('通道名', 参数)
 *   向主进程发消息，主进程在 index.ts 中用 ipcMain.handle
 *   注册对应的处理程序来响应这些消息。
 *
 * 安全原则："最小权限原则"——
 *   只暴露前端确实需要的方法，不暴露整个 ipcRenderer 对象。
 *   即使前端页面被注入了恶意代码，攻击者也拿不到系统权限。
 */

import { contextBridge, ipcRenderer } from 'electron'

// ============================================================
// 数据类型定义（和 electron.d.ts 中保持一致）
// 此处重复定义是因为 preload 脚本运行在独立的上下文中，
// 无法直接引用渲染进程的类型文件
// ============================================================

/** 新增/编辑账单的输入数据结构 */
export interface BillInput {
  amount: number
  category_l1: string
  category_l2: string
  date: string
  note?: string
}

/** 新增分类的输入数据结构 */
export interface CategoryInput {
  name_l1: string
  name_l2: string
}

/** 修改分类的输入数据结构（新旧对照） */
export interface CategoryUpdateData {
  id: number
  oldL1: string
  oldL2: string
  newL1: string
  newL2: string
}

/** 删除分类的输入数据结构 */
export interface CategoryDeleteData {
  id: number
  name_l1: string
  name_l2: string
}

// ============================================================
// 核心：向渲染进程暴露安全的 API 接口
// ============================================================

/**
 * contextBridge.exposeInMainWorld — 安全的"桥梁"函数
 *
 * 参数1：'api' — 前端通过 window.api 来访问这些方法
 * 参数2：方法对象 — 每个方法内部调用 ipcRenderer.invoke 向主进程发消息
 *
 * 注意：这里用的是 contextBridge（安全）而非直接挂载到 window 上（不安全）。
 *       直接挂载在 sandbox 模式下会被阻止，contextBridge 是官方推荐的方式。
 */
contextBridge.exposeInMainWorld('api', {
  // ==========================================================
  // 账单操作 — 对应主进程 bills:* 通道
  // ==========================================================

  /** 获取全部账单列表 */
  getBills: () => ipcRenderer.invoke('bills:getAll'),
  /** 新增一笔账单，传入金额、分类、日期等 */
  addBill: (bill: BillInput) => ipcRenderer.invoke('bills:add', bill),
  /** 修改一笔账单，传入 id + 修改后的数据 */
  updateBill: (bill: BillInput & { id: number }) => ipcRenderer.invoke('bills:update', bill),
  /** 根据 id 删除一笔账单 */
  deleteBill: (id: number) => ipcRenderer.invoke('bills:delete', id),

  // ==========================================================
  // 统计查询 — 对应主进程 stats:* 通道
  // ==========================================================

  /** 查询今日总支出（首页的"今日支出"卡片用） */
  getTodayTotal: () => ipcRenderer.invoke('stats:todayTotal'),
  /** 查询某月总支出 */
  getMonthTotal: (year: number, month: number) =>
    ipcRenderer.invoke('stats:monthTotal', year, month),
  /** 查询某月全部账单明细 */
  getMonthBills: (year: number, month: number) =>
    ipcRenderer.invoke('stats:monthBills', year, month),
  /** 查询某月完整统计（总支出、日均、分类占比等） */
  getMonthStats: (year: number, month: number) =>
    ipcRenderer.invoke('stats:monthStats', year, month),
  /** 查询自定义日期范围的统计数据 */
  getRangeStats: (start: string, end: string) =>
    ipcRenderer.invoke('stats:rangeStats', start, end),
  /** 查询全年 12 个月的月度趋势（统计页面的柱状图用） */
  getMonthlyTrend: (year: number) => ipcRenderer.invoke('stats:monthlyTrend', year),

  // ==========================================================
  // 分类管理 — 对应主进程 categories:* 通道
  // ==========================================================

  /** 获取全部两级分类列表 */
  getCategories: () => ipcRenderer.invoke('categories:getAll'),
  /** 获取按大类分组后的分类数据（用于联动下拉框） */
  getCategoriesGrouped: () => ipcRenderer.invoke('categories:getGrouped'),
  /** 获取所有一级大类名称列表 */
  getL1Categories: () => ipcRenderer.invoke('categories:getL1'),
  /** 新增一个分类 */
  addCategory: (cat: CategoryInput) => ipcRenderer.invoke('categories:add', cat),
  /** 修改分类名称（会同步更新所有引用该分类的账单） */
  updateCategory: (data: CategoryUpdateData) => ipcRenderer.invoke('categories:update', data),
  /** 删除分类（如果该分类下还有账单则拒绝删除） */
  deleteCategory: (data: CategoryDeleteData) =>
    ipcRenderer.invoke('categories:delete', data),

  // ==========================================================
  // 数据管理 — 对应主进程 data:* 通道
  // ==========================================================

  /** 导出账单为 CSV 文件（可在 Excel 中打开） */
  exportCSV: () => ipcRenderer.invoke('data:exportCSV'),
  /** 备份数据库文件到指定位置 */
  backupDatabase: () => ipcRenderer.invoke('data:backup'),
  /** 从备份文件恢复数据（会覆盖当前数据） */
  restoreDatabase: () => ipcRenderer.invoke('data:restore'),
  /** 清空全部账单数据（前端会先弹出二次确认） */
  clearAllData: () => ipcRenderer.invoke('data:clear'),
  /** 获取数据库文件的存放路径 */
  getDatabasePath: () => ipcRenderer.invoke('data:getPath')
})
