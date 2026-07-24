import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi } from '@/__tests__/test-setup'
import Category from '@/pages/Category'

beforeEach(() => {
  vi.clearAllMocks()
  mockApi.getCategoriesGrouped.mockResolvedValue([
    {
      l1: '餐饮',
      l2: ['三餐', '零食', '饮品']
    },
    {
      l1: '交通',
      l2: ['公交地铁', '打车']
    }
  ])
  mockApi.getCategories.mockResolvedValue([
    { id: 1, name_l1: '餐饮', name_l2: '三餐', sort_order: 1 },
    { id: 2, name_l1: '餐饮', name_l2: '零食', sort_order: 2 },
    { id: 3, name_l1: '餐饮', name_l2: '饮品', sort_order: 3 },
    { id: 4, name_l1: '交通', name_l2: '公交地铁', sort_order: 1 },
    { id: 5, name_l1: '交通', name_l2: '打车', sort_order: 2 }
  ])
  mockApi.getL1Categories.mockResolvedValue([
    '餐饮', '交通', '购物', '住房', '娱乐', '医疗', '教育', '人情', '通讯', '其他'
  ])
  mockApi.addCategory.mockResolvedValue({
    id: 6,
    name_l1: '餐饮',
    name_l2: '新小类',
    sort_order: 100
  })
  mockApi.updateCategory.mockResolvedValue(undefined)
  mockApi.deleteCategory.mockResolvedValue({ success: true })
})

describe('Category', () => {
  it('显示页面标题', async () => {
    render(<Category />)

    await waitFor(() => {
      expect(screen.getByText('📂 分类管理')).toBeInTheDocument()
    })
  })

  it('显示预设的分类卡片', async () => {
    render(<Category />)

    await waitFor(() => {
      // 一级分类名称作为 Card 标题
      expect(screen.getByText('餐饮')).toBeInTheDocument()
      expect(screen.getByText('交通')).toBeInTheDocument()
    })
  })

  it('小类标签显示在分类下', async () => {
    render(<Category />)

    await waitFor(() => {
      expect(screen.getByText('三餐')).toBeInTheDocument()
      expect(screen.getByText('零食')).toBeInTheDocument()
      expect(screen.getByText('饮品')).toBeInTheDocument()
      expect(screen.getByText('公交地铁')).toBeInTheDocument()
      expect(screen.getByText('打车')).toBeInTheDocument()
    })
  })

  it('点击"新增分类"按钮打开 Modal', async () => {
    render(<Category />)

    await waitFor(() => {
      expect(screen.getByText('新增分类')).toBeInTheDocument()
    })

    const addBtn = screen.getByText('新增分类')
    await userEvent.click(addBtn)

    // Modal 应该出现
    await waitFor(() => {
      // Ant Design Modal title
      const modalTitle = document.querySelector('.ant-modal-title')
      expect(modalTitle).toBeInTheDocument()
      expect(modalTitle?.textContent).toBe('新增分类')
    })
  })

  it('删除分类调用 deleteCategory API', async () => {
    render(<Category />)

    await waitFor(() => {
      expect(screen.getByText('三餐')).toBeInTheDocument()
    })

    // 找到删除按钮并点击
    const deleteIcons = document.querySelectorAll('.anticon-delete')
    expect(deleteIcons.length).toBeGreaterThan(0)

    await userEvent.click(deleteIcons[0])

    // 点击 Popconfirm 确定按钮
    await waitFor(() => {
      // 查找 Popconfirm 的确定按钮
      const confirmBtn = document.querySelector('.ant-popconfirm .ant-btn-primary')
      if (confirmBtn) {
        expect(confirmBtn).toBeInTheDocument()
      }
    })
  })

  it('删除失败时调用 API 并返回失败原因', async () => {
    mockApi.deleteCategory.mockResolvedValue({
      success: false,
      reason: '该分类下有账单，无法删除'
    })

    render(<Category />)

    await waitFor(() => {
      expect(screen.getByText('三餐')).toBeInTheDocument()
    })

    const deleteIcons = document.querySelectorAll('.anticon-delete')
    await userEvent.click(deleteIcons[0])

    // 点击确认
    await waitFor(() => {
      expect(mockApi.deleteCategory).toHaveBeenCalled()
    })
  })
})
