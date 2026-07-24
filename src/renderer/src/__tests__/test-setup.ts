import { vi } from 'vitest'
import '@testing-library/jest-dom'

// ============================================================
// window.api mock — 模拟 Electron IPC 调用
// ============================================================

const mockApi = {
  getBills: vi.fn().mockResolvedValue([]),
  addBill: vi.fn().mockResolvedValue({
    id: 1,
    amount: 0,
    category_l1: '',
    category_l2: '',
    date: '',
    note: '',
    created_at: '',
    updated_at: ''
  }),
  updateBill: vi.fn().mockResolvedValue(undefined),
  deleteBill: vi.fn().mockResolvedValue(undefined),
  getTodayTotal: vi.fn().mockResolvedValue(0),
  getMonthTotal: vi.fn().mockResolvedValue(0),
  getMonthBills: vi.fn().mockResolvedValue([]),
  getCategories: vi.fn().mockResolvedValue([]),
  getCategoriesGrouped: vi.fn().mockResolvedValue([]),
  getL1Categories: vi.fn().mockResolvedValue([]),
  addCategory: vi.fn().mockResolvedValue({
    id: 1,
    name_l1: '',
    name_l2: '',
    sort_order: 0
  }),
  updateCategory: vi.fn().mockResolvedValue(undefined),
  deleteCategory: vi.fn().mockResolvedValue({ success: true } as const),
  getMonthStats: vi.fn().mockResolvedValue({
    total: 0,
    avgDaily: 0,
    recordDays: 0,
    billCount: 0,
    byCategory: []
  }),
  getRangeStats: vi.fn().mockResolvedValue({
    total: 0,
    avgDaily: 0,
    recordDays: 0,
    billCount: 0,
    byCategory: []
  }),
  getMonthlyTrend: vi.fn().mockResolvedValue([]),
  exportCSV: vi.fn().mockResolvedValue({ success: false } as const),
  backupDatabase: vi.fn().mockResolvedValue({ success: false } as const),
  restoreDatabase: vi.fn().mockResolvedValue({ success: false } as const),
  clearAllData: vi.fn().mockResolvedValue({ success: false } as const),
  getDatabasePath: vi.fn().mockResolvedValue('')
}

Object.defineProperty(window, 'api', {
  value: mockApi,
  writable: true,
  configurable: true
})

export { mockApi }

// ============================================================
// window.matchMedia polyfill（Ant Design 依赖）
// ============================================================

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
})

// ============================================================
// Canvas mock（贪吃蛇游戏依赖）
// ============================================================

HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
  fillRect: vi.fn(),
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 0,
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  shadowColor: '',
  shadowBlur: 0,
  font: '',
  textAlign: '',
  fillText: vi.fn(),
  scale: vi.fn()
} as unknown as CanvasRenderingContext2D)

Object.defineProperty(window, 'devicePixelRatio', { value: 1, writable: true })

// ============================================================
// Ant Design message / Modal 静态方法 mock
// ============================================================

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd')
  return {
    ...actual,
    message: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn()
    }
  }
})

// ============================================================
// ECharts mock（Statistics 页面依赖）
// ============================================================

vi.mock('echarts-for-react/lib/core', () => {
  const React = require('react')
  return {
    default: ({ option }: { option: unknown }) =>
      React.createElement('div', {
        'data-testid': 'echart',
        'data-option': JSON.stringify(option)
      })
  }
})

// ============================================================
// scrollTo polyfill（jsdom 未实现）
// ============================================================

window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
