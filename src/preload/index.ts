import { contextBridge, ipcRenderer } from 'electron'

export interface BillInput {
  amount: number
  category_l1: string
  category_l2: string
  date: string
  note?: string
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

contextBridge.exposeInMainWorld('api', {
  // Bill operations
  getBills: () => ipcRenderer.invoke('bills:getAll'),
  addBill: (bill: BillInput) => ipcRenderer.invoke('bills:add', bill),
  updateBill: (bill: BillInput & { id: number }) => ipcRenderer.invoke('bills:update', bill),
  deleteBill: (id: number) => ipcRenderer.invoke('bills:delete', id),

  // Stats
  getTodayTotal: () => ipcRenderer.invoke('stats:todayTotal'),
  getMonthTotal: (year: number, month: number) =>
    ipcRenderer.invoke('stats:monthTotal', year, month),
  getMonthBills: (year: number, month: number) =>
    ipcRenderer.invoke('stats:monthBills', year, month),
  getMonthStats: (year: number, month: number) =>
    ipcRenderer.invoke('stats:monthStats', year, month),
  getRangeStats: (start: string, end: string) =>
    ipcRenderer.invoke('stats:rangeStats', start, end),
  getMonthlyTrend: (year: number) => ipcRenderer.invoke('stats:monthlyTrend', year),

  // Data management
  exportCSV: () => ipcRenderer.invoke('data:exportCSV'),
  backupDatabase: () => ipcRenderer.invoke('data:backup'),
  restoreDatabase: () => ipcRenderer.invoke('data:restore'),
  clearAllData: () => ipcRenderer.invoke('data:clear'),
  getDatabasePath: () => ipcRenderer.invoke('data:getPath'),

  // Categories
  getCategories: () => ipcRenderer.invoke('categories:getAll'),
  getCategoriesGrouped: () => ipcRenderer.invoke('categories:getGrouped'),
  getL1Categories: () => ipcRenderer.invoke('categories:getL1'),
  addCategory: (cat: CategoryInput) => ipcRenderer.invoke('categories:add', cat),
  updateCategory: (data: CategoryUpdateData) => ipcRenderer.invoke('categories:update', data),
  deleteCategory: (data: CategoryDeleteData) =>
    ipcRenderer.invoke('categories:delete', data)
})
