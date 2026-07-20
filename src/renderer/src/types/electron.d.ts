export interface BillRecord {
  id: number
  amount: number
  category_l1: string
  category_l2: string
  date: string
  note: string
  created_at: string
  updated_at: string
}

export interface BillInput {
  amount: number
  category_l1: string
  category_l2: string
  date: string
  note?: string
}

export interface CategoryRecord {
  id: number
  name_l1: string
  name_l2: string
  sort_order: number
}

export interface CategoryGrouped {
  l1: string
  l2: string[]
}

export interface CategoryInput {
  name_l1: string
  name_l2: string
}

export interface CategoryUpdateData {
  id: number
  oldL1: string
  oldL2: string
  newL1: string
  newL2: string
}

export interface CategoryDeleteData {
  id: number
  name_l1: string
  name_l2: string
}

export interface CategoryDeleteResult {
  success: boolean
  reason?: string
}

export interface CategoryStat {
  name: string
  amount: number
  percentage: number
}

export interface MonthStats {
  total: number
  avgDaily: number
  recordDays: number
  billCount: number
  byCategory: CategoryStat[]
}

export interface TrendItem {
  month: string
  total: number
  byCategory: { name: string; amount: number }[]
}

export interface ElectronAPI {
  getBills: () => Promise<BillRecord[]>
  addBill: (bill: BillInput) => Promise<BillRecord>
  updateBill: (bill: BillInput & { id: number }) => Promise<void>
  deleteBill: (id: number) => Promise<void>
  getTodayTotal: () => Promise<number>
  getMonthTotal: (year: number, month: number) => Promise<number>
  getMonthBills: (year: number, month: number) => Promise<BillRecord[]>
  getCategories: () => Promise<CategoryRecord[]>
  getCategoriesGrouped: () => Promise<CategoryGrouped[]>
  getL1Categories: () => Promise<string[]>
  addCategory: (cat: CategoryInput) => Promise<CategoryRecord>
  updateCategory: (data: CategoryUpdateData) => Promise<void>
  deleteCategory: (data: CategoryDeleteData) => Promise<CategoryDeleteResult>
  getMonthStats: (year: number, month: number) => Promise<MonthStats>
  getRangeStats: (start: string, end: string) => Promise<MonthStats>
  getMonthlyTrend: (year: number) => Promise<TrendItem[]>
  exportCSV: () => Promise<{ success: boolean; path?: string }>
  backupDatabase: () => Promise<{ success: boolean; path?: string }>
  restoreDatabase: () => Promise<{ success: boolean }>
  clearAllData: () => Promise<{ success: boolean }>
  getDatabasePath: () => Promise<string>
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
