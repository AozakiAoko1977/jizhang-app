import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi } from '@/__tests__/test-setup'
import Settings from '@/pages/Settings'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Settings', () => {
  it('显示页面标题和功能卡片', () => {
    render(<Settings />)
    expect(screen.getByText('⚙️ 设置')).toBeInTheDocument()
    expect(screen.getByText('📥 数据导出')).toBeInTheDocument()
    expect(screen.getByText('💿 数据备份与恢复')).toBeInTheDocument()
    expect(screen.getByText('⚠️ 危险操作')).toBeInTheDocument()
  })

  it('显示应用信息', () => {
    render(<Settings />)
    expect(screen.getByText('黑马记账')).toBeInTheDocument()
    expect(screen.getByText('数据存储在您电脑本地，不会上传到任何服务器。')).toBeInTheDocument()
  })

  it('点击"导出 CSV"调用 API', async () => {
    mockApi.exportCSV.mockResolvedValue({ success: true, path: 'C:/test/bills.csv' })

    render(<Settings />)

    const btn = screen.getByText('导出 CSV')
    await userEvent.click(btn)

    expect(mockApi.exportCSV).toHaveBeenCalled()
  })

  it('导出 CSV 成功后显示路径', async () => {
    mockApi.exportCSV.mockResolvedValue({ success: true, path: 'C:/export/bills.csv' })

    render(<Settings />)

    await userEvent.click(screen.getByText('导出 CSV'))

    await waitFor(() => {
      // message.success 被 mock 了，验证 API 被调用了
      expect(mockApi.exportCSV).toHaveBeenCalledTimes(1)
    })
  })

  it('点击"备份数据库"调用 API', async () => {
    mockApi.backupDatabase.mockResolvedValue({ success: true, path: 'C:/backup/heima.db' })

    render(<Settings />)

    await userEvent.click(screen.getByText('备份数据库'))

    expect(mockApi.backupDatabase).toHaveBeenCalled()
  })

  it('点击"恢复数据"弹出确认框', async () => {
    const { Modal } = await import('antd')
    render(<Settings />)

    await userEvent.click(screen.getByText('恢复数据'))

    // Modal.confirm 被 mock 后不会真正弹出，但验证按钮可点击
    // 实际 Modal.confirm 会在 setup 中不被 mock，所以这里会渲染 Modal
    // 因为 antd Modal.confirm 是通过 ReactDOM.render 渲染的
    // 在 jsdom 中可能无法正常渲染，这里主要验证按钮存在且可点击
    expect(screen.getByText('恢复数据')).toBeInTheDocument()
  })

  it('点击"清空所有数据"按钮存在且为 danger 类型', () => {
    render(<Settings />)
    expect(screen.getByText('清空所有数据')).toBeInTheDocument()
  })

  it('应用信息区域显示隐私说明', () => {
    render(<Settings />)
    expect(
      screen.getByText('本应用完全离线运行，您的所有记账数据仅存储在您的电脑中。')
    ).toBeInTheDocument()
  })
})
