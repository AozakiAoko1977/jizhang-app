import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { mockApi } from '@/__tests__/test-setup'
import Record from '@/pages/Record'

beforeEach(() => {
  vi.clearAllMocks()
  mockApi.getCategoriesGrouped.mockResolvedValue([
    {
      l1: '餐饮',
      l2: ['三餐', '零食', '饮品', '外卖', '聚餐']
    },
    {
      l1: '交通',
      l2: ['公交地铁', '打车', '加油', '停车', '高铁/机票']
    }
  ])
  mockApi.getBills.mockResolvedValue([])
})

describe('Record', () => {
  it('显示页面标题', async () => {
    render(
      <MemoryRouter>
        <Record />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('记一笔')).toBeInTheDocument()
    })
  })

  it('金额输入框使用"金额"占位符', async () => {
    render(
      <MemoryRouter>
        <Record />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByPlaceholderText('金额')).toBeInTheDocument()
    })
  })

  it('一级分类下拉使用"一级分类"占位符', async () => {
    render(
      <MemoryRouter>
        <Record />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('一级分类')).toBeInTheDocument()
    })
  })

  it('二级分类下拉使用"二级分类"占位符', async () => {
    render(
      <MemoryRouter>
        <Record />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('二级分类')).toBeInTheDocument()
    })
  })

  it('备注输入框使用"备注（可选）"占位符', async () => {
    render(
      <MemoryRouter>
        <Record />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByPlaceholderText('备注（可选）')).toBeInTheDocument()
    })
  })

  it('表单有金额、分类、日期、备注字段', async () => {
    render(
      <MemoryRouter>
        <Record />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByPlaceholderText('金额')).toBeInTheDocument()
      expect(screen.getByText('一级分类')).toBeInTheDocument()
      expect(screen.getByText('二级分类')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('备注（可选）')).toBeInTheDocument()
    })
  })

  it('空账单列表时显示引导文案', async () => {
    render(
      <MemoryRouter>
        <Record />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('还没有账单，快去记一笔吧 📝')).toBeInTheDocument()
    })
  })

  it('有账单时表格显示数据', async () => {
    mockApi.getBills.mockResolvedValue([
      {
        id: 1,
        amount: 50,
        category_l1: '交通',
        category_l2: '打车',
        date: '2026-07-20',
        note: '去公司',
        created_at: '',
        updated_at: ''
      }
    ])

    render(
      <MemoryRouter>
        <Record />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('¥ 50.00')).toBeInTheDocument()
    })
  })
})
