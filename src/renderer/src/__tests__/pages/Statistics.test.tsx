import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi } from '@/__tests__/test-setup'
import Statistics from '@/pages/Statistics'

beforeEach(() => {
  vi.clearAllMocks()
  mockApi.getMonthStats.mockResolvedValue({
    total: 3200,
    avgDaily: 106.67,
    recordDays: 22,
    billCount: 45,
    byCategory: [
      { name: '餐饮', amount: 1500, percentage: 46.88 },
      { name: '交通', amount: 800, percentage: 25.0 },
      { name: '购物', amount: 500, percentage: 15.63 },
      { name: '娱乐', amount: 400, percentage: 12.5 }
    ]
  })
  mockApi.getMonthlyTrend.mockResolvedValue([
    { month: '2026-01', total: 2800, byCategory: [] },
    { month: '2026-02', total: 3100, byCategory: [] },
    { month: '2026-03', total: 2600, byCategory: [] },
    { month: '2026-04', total: 3500, byCategory: [] },
    { month: '2026-05', total: 3200, byCategory: [] },
    { month: '2026-06', total: 4000, byCategory: [] },
    { month: '2026-07', total: 3200, byCategory: [] }
  ])
  mockApi.getRangeStats.mockResolvedValue({
    total: 1500,
    avgDaily: 50,
    recordDays: 30,
    billCount: 20,
    byCategory: [
      { name: '餐饮', amount: 800, percentage: 53.33 },
      { name: '交通', amount: 700, percentage: 46.67 }
    ]
  })
})

describe('Statistics', () => {
  it('显示页面标题', async () => {
    render(<Statistics />)

    await waitFor(() => {
      expect(screen.getByText('📊 统计分析')).toBeInTheDocument()
    })
  })

  it('显示视图切换器', async () => {
    render(<Statistics />)

    await waitFor(() => {
      expect(screen.getByText('按月查看')).toBeInTheDocument()
      expect(screen.getByText('自定义范围')).toBeInTheDocument()
    })
  })

  it('按月默认加载后显示 12 个月选择', async () => {
    render(<Statistics />)

    await waitFor(() => {
      expect(screen.getByText('1月')).toBeInTheDocument()
      expect(screen.getByText('7月')).toBeInTheDocument()
      expect(screen.getByText('12月')).toBeInTheDocument()
    })
  })

  it('切换到自定义范围模式后隐藏月份选择', async () => {
    mockApi.getRangeStats.mockResolvedValue({
      total: 0,
      avgDaily: 0,
      recordDays: 0,
      billCount: 0,
      byCategory: []
    })

    render(<Statistics />)

    await waitFor(() => {
      expect(screen.getByText('自定义范围')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByText('自定义范围'))

    await waitFor(() => {
      // 切换到自定义范围后，"1月" 不再出现
      expect(screen.queryByText('1月')).toBeNull()
    })
  })

  it('无数据时显示空状态引导', async () => {
    mockApi.getMonthStats.mockResolvedValue({
      total: 0,
      avgDaily: 0,
      recordDays: 0,
      billCount: 0,
      byCategory: []
    })

    render(<Statistics />)

    await waitFor(() => {
      expect(screen.getByText('请选择日期范围查看统计')).toBeInTheDocument()
    })
  })

  it('饼图 ECharts 组件被渲染为 mock div', async () => {
    render(<Statistics />)

    await waitFor(() => {
      const echartElements = document.querySelectorAll('[data-testid="echart"]')
      expect(echartElements.length).toBeGreaterThan(0)
    })
  })
})
