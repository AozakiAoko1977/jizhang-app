import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '@/App'

describe('App', () => {
  it('访问根路径 / 重定向到 /home', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )

    // 重定向后应显示 Home 页面内容
    expect(screen.getByText('📋 概览')).toBeInTheDocument()
  })

  it('访问 /home 显示首页', () => {
    render(
      <MemoryRouter initialEntries={['/home']}>
        <App />
      </MemoryRouter>
    )

    expect(screen.getByText('📋 概览')).toBeInTheDocument()
  })

  it('访问 /record 显示记账页', () => {
    render(
      <MemoryRouter initialEntries={['/record']}>
        <App />
      </MemoryRouter>
    )

    expect(screen.getByText('✏️ 记一笔')).toBeInTheDocument()
  })

  it('访问 /snake 显示贪吃蛇', () => {
    render(
      <MemoryRouter initialEntries={['/snake']}>
        <App />
      </MemoryRouter>
    )

    expect(screen.getByText('🐍 贪吃蛇')).toBeInTheDocument()
  })

  it('访问 /settings 显示设置页', () => {
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <App />
      </MemoryRouter>
    )

    expect(screen.getByText('⚙️ 设置')).toBeInTheDocument()
  })

  it('侧边栏出现在所有页面中', () => {
    render(
      <MemoryRouter initialEntries={['/home']}>
        <App />
      </MemoryRouter>
    )

    // 侧边栏菜单项
    expect(screen.getByText('首页')).toBeInTheDocument()
    expect(screen.getByText('记账')).toBeInTheDocument()
  })
})
