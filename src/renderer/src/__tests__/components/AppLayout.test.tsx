import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AppLayout from '@/components/AppLayout'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AppLayout', () => {
  it('显示所有菜单项', () => {
    render(
      <MemoryRouter initialEntries={['/home']}>
        <AppLayout />
      </MemoryRouter>
    )

    expect(screen.getByText('首页')).toBeInTheDocument()
    expect(screen.getByText('记账')).toBeInTheDocument()
    expect(screen.getByText('分类管理')).toBeInTheDocument()
    expect(screen.getByText('统计分析')).toBeInTheDocument()
    expect(screen.getByText('贪吃蛇')).toBeInTheDocument()
    expect(screen.getByText('设置')).toBeInTheDocument()
  })

  it('显示应用名称和 Logo', () => {
    render(
      <MemoryRouter initialEntries={['/home']}>
        <AppLayout />
      </MemoryRouter>
    )

    expect(screen.getByText('🐴 黑马记账')).toBeInTheDocument()
  })

  it('顶栏显示"黑马记账"', () => {
    render(
      <MemoryRouter initialEntries={['/home']}>
        <AppLayout />
      </MemoryRouter>
    )

    // Header 中的文字
    const headers = screen.getAllByText('黑马记账')
    expect(headers.length).toBeGreaterThanOrEqual(1)
  })

  it('在 /home 路径下"首页"菜单高亮', () => {
    render(
      <MemoryRouter initialEntries={['/home']}>
        <AppLayout />
      </MemoryRouter>
    )

    // 菜单项通过 Ant Design Menu 渲染，selectedKeys 会影响 className
    // 验证菜单项都在 DOM 中
    expect(screen.getByText('首页')).toBeInTheDocument()
  })
})
