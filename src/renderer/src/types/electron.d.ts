/**
 * electron.d.ts — TypeScript 类型定义文件
 * =============================================
 * 这个文件定义了前端（React 渲染进程）和 Electron API 之间
 * 通信时用到的所有数据结构。
 *
 * 通俗解释：就像一份"合同"，约定了前后端之间传什么数据、
 * 每个字段是什么类型（数字、字符串、是必填还是可选）。
 *
 * 类型定义的好处：
 *   ① 写代码时有智能提示（编辑器会自动补全字段名）
 *   ② 写错了会立刻报错（比如把 amount 写成字符串会标红）
 *   ③ 新加入的开发者看这个文件就能理解整个数据模型
 */

// ============================================================
// 账单相关类型
// ============================================================

/**
 * BillRecord — 从数据库读取的完整账单记录
 * 包含了 id 和自动生成的时间戳（创建时间、修改时间）
 */
export interface BillRecord {
  id: number
  amount: number          // 金额（单位：元，人民币，如 88.50）
  category_l1: string     // 一级大类名称（如 "🍜 餐饮"）
  category_l2: string     // 二级小类名称（如 "三餐"）
  date: string            // 日期（格式 YYYY-MM-DD，如 "2026-07-23"）
  note: string            // 备注（用户自己填的说明文字）
  created_at: string      // 数据库自动记录：创建时间
  updated_at: string      // 数据库自动记录：最后修改时间
}

/**
 * BillInput — 新增/编辑账单时的输入数据
 * 和 BillRecord 的区别：不需要 id（新增时还没有）和自动时间戳
 * note 是可选的——用户可以不填备注
 */
export interface BillInput {
  amount: number
  category_l1: string
  category_l2: string
  date: string
  note?: string           // ? 表示可选字段，不填就是空字符串
}

// ============================================================
// 分类相关类型
// ============================================================

/**
 * CategoryRecord — 数据库中的分类记录
 * sort_order 决定了显示顺序（数字越小越靠前）
 */
export interface CategoryRecord {
  id: number
  name_l1: string
  name_l2: string
  sort_order: number      // 排序权重，用于控制分类在列表中的显示顺序
}

/**
 * CategoryGrouped — 按大类分组后的数据结构
 * 用于：账单表单的联动下拉框（先选大类 → 再选对应的小类）
 *
 * 示例：{ l1: "🍜 餐饮", l2: ["三餐", "零食", "饮品", "外卖", "聚餐"] }
 */
export interface CategoryGrouped {
  l1: string
  l2: string[]
}

/**
 * CategoryInput — 新增分类时需要提供的数据
 * 小类必须归属到某个大类下面
 */
export interface CategoryInput {
  name_l1: string         // 所属的一级大类名称
  name_l2: string         // 要创建的二级小类名称
}

/**
 * CategoryUpdateData — 修改分类时需要提供的数据
 * 包含旧名称（用于查找和更新关联账单）和新名称
 *
 * 为什么要传旧名称？
 *   修改分类时，需要把 bills 表中所有引用旧分类名的账单同步更新。
 *   所以既要知道"新的叫什么"也要知道"旧的叫什么"。
 */
export interface CategoryUpdateData {
  id: number
  oldL1: string           // 修改前的一级大类名称
  oldL2: string           // 修改前的二级小类名称
  newL1: string           // 修改后的一级大类名称
  newL2: string           // 修改后的二级小类名称
}

/**
 * CategoryDeleteData — 删除分类时需要提供的数据
 * 不仅需要 id，还需要名称——因为后端要检查
 * 这个分类下是否还有账单（有则不允许删除）
 */
export interface CategoryDeleteData {
  id: number
  name_l1: string
  name_l2: string
}

/**
 * CategoryDeleteResult — 删除分类操作的结果
 * success = true  → 删除成功
 * success = false → 删除失败，reason 字段说明原因（如"该分类下有3条账单"）
 */
export interface CategoryDeleteResult {
  success: boolean
  reason?: string
}

// ============================================================
// 统计相关类型
// ============================================================

/**
 * CategoryStat — 单个分类的统计数据
 * percentage 是百分比数值，如 35.5 表示 35.5%
 */
export interface CategoryStat {
  name: string
  amount: number
  percentage: number
}

/**
 * MonthStats — 月度统计概览（统计页面的核心数据结构）
 * total      — 本月总支出
 * avgDaily   — 日均支出（总支出 ÷ 当月天数，不管那天有没有记账）
 * recordDays — 本月有多少天记了账（用于衡量记账频率）
 * billCount  — 本月一共记了多少笔
 * byCategory — 按一级大类拆分，看每类各花了多少钱、占比多少
 */
export interface MonthStats {
  total: number
  avgDaily: number
  recordDays: number
  billCount: number
  byCategory: CategoryStat[]
}

/**
 * TrendItem — 月度趋势图的一个数据点
 * month       — 月份（格式 YYYY-MM，如 "2026-07"）
 * total       — 该月总支出
 * byCategory  — 该月按大类拆分的支出明细
 */
export interface TrendItem {
  month: string
  total: number
  byCategory: { name: string; amount: number }[]
}

// ============================================================
// Electron API 接口 — 前端调用 window.api.xxx() 的类型定义
// ============================================================

/**
 * ElectronAPI — 定义了前端可以调用的所有后端方法
 *
 * 所有方法都是异步的（返回 Promise），因为 IPC 通信本身是异步的——
 * 前端发请求给主进程，主进程处理完再回传结果，这个过程中前端界面
 * 不会被卡住（类似网页发请求等服务器回复）。
 *
 * 这个接口和 preload/index.ts 中 contextBridge.exposeInMainWorld
 * 暴露的 api 对象一一对应，字段名必须一致。
 */
export interface ElectronAPI {
  // 账单 CRUD
  getBills: () => Promise<BillRecord[]>
  addBill: (bill: BillInput) => Promise<BillRecord>
  updateBill: (bill: BillInput & { id: number }) => Promise<void>
  deleteBill: (id: number) => Promise<void>

  // 统计查询
  getTodayTotal: () => Promise<number>
  getMonthTotal: (year: number, month: number) => Promise<number>
  getMonthBills: (year: number, month: number) => Promise<BillRecord[]>
  getMonthStats: (year: number, month: number) => Promise<MonthStats>
  getRangeStats: (start: string, end: string) => Promise<MonthStats>
  getMonthlyTrend: (year: number) => Promise<TrendItem[]>

  // 分类管理
  getCategories: () => Promise<CategoryRecord[]>
  getCategoriesGrouped: () => Promise<CategoryGrouped[]>
  getL1Categories: () => Promise<string[]>
  addCategory: (cat: CategoryInput) => Promise<CategoryRecord>
  updateCategory: (data: CategoryUpdateData) => Promise<void>
  deleteCategory: (data: CategoryDeleteData) => Promise<CategoryDeleteResult>

  // 数据管理
  exportCSV: () => Promise<{ success: boolean; path?: string }>
  backupDatabase: () => Promise<{ success: boolean; path?: string }>
  restoreDatabase: () => Promise<{ success: boolean }>
  clearAllData: () => Promise<{ success: boolean }>
  getDatabasePath: () => Promise<string>
}

/**
 * 扩展 Window 类型，告诉 TypeScript：
 * "window 对象上有一个 api 属性，它的类型是 ElectronAPI"
 * 这样在所有 .tsx 文件中写 window.api.xxx() 时都不会报类型错误
 */
declare global {
  interface Window {
    api: ElectronAPI
  }
}
