import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { mockApi } from '@/__tests__/test-setup'
import Home from '@/pages/Home'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

beforeEach(() => {
  vi.clearAllMocks()
  mockApi.getTodayTotal.mockResolvedValue(0)
  mockApi.getMonthTotal.mockResolvedValue(0)
  mockApi.getBills.mockResolvedValue([])
})

describe('Home', () => {
  it('显示页面标题和统计卡片', async () => {
    mockApi.getTodayTotal.mockResolvedValue(88.5)
    mockApi.getMonthTotal.mockResolvedValue(3200)
    mockApi.getBills.mockResolvedValue([])

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )

    expect(screen.getByText('📋 概览')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('¥ 88.50')).toBeInTheDocument()
      expect(screen.getByText('¥ 3200.00')).toBeInTheDocument()
    })
  })

  it('显示最近 10 条账单', async () => {
    const bills = Array.from({ length: 15 }, (_, i) => ({
      id: i + 1,
      amount: (i + 1) * 10,
      category_l1: '餐饮',
      category_l2: '三餐',
      date: `2026-07-${String(20 - i).padStart(2, '0')}`,
      note: `备注${i + 1}`,
      created_at: '',
      updated_at: ''
    }))
    mockApi.getBills.mockResolvedValue(bills)

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )

    await waitFor(() => {
      // 应该只显示 10 条（slice 截断）
      expect(screen.getByText('备注1')).toBeInTheDocument()
      expect(screen.getByText('¥ 10.00')).toBeInTheDocument()
    })
  })

  it('备注为空时显示 "-"', async () => {
    mockApi.getBills.mockResolvedValue([
      {
        id: 1,
        amount: 50,
        category_l1: '交通',
        category_l2: '打车',
        date: '2026-07-20',
        note: '',
        created_at: '',
        updated_at: ''
      }
    ])

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('-')).toBeInTheDocument()
    })
  })

  it('快捷入口卡片渲染三张', async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )

    expect(screen.getByText('记一笔')).toBeInTheDocument()
    expect(screen.getByText('管理分类')).toBeInTheDocument()
    expect(screen.getByText('查看统计')).toBeInTheDocument()
  })

  it('点击"记一笔"跳转到记账页', async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )

    await userEvent.click(screen.getByText('记一笔'))
    expect(mockNavigate).toHaveBeenCalledWith('/record')
  })

  it('点击"管理分类"跳转到分类管理', async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )

    await userEvent.click(screen.getByText('管理分类'))
    expect(mockNavigate).toHaveBeenCalledWith('/category')
  })

  it('点击"查看统计"跳转到统计分析', async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )

    await userEvent.click(screen.getByText('查看统计'))
    expect(mockNavigate).toHaveBeenCalledWith('/statistics')
  })

  it('空账单列表时显示引导文案', async () => {
    mockApi.getBills.mockResolvedValue([])

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('还没有账单，点击"记一笔"开始记账吧 📝')).toBeInTheDocument()
    })
  })
})
