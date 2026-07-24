/**
 * Settings.tsx -- 设置页面
 * ====================================
 *
 * 这个文件是应用的设置中心，负责数据的导入导出和安全管理。
 * 主要功能包括：导出 CSV、备份数据库、恢复数据、清空数据。
 *
 * 所有数据存储在用户电脑本地，不会上传到任何服务器。
 * 建议定期备份以防数据丢失。
 */

import { useState } from 'react'
import {
  Card,
  Button,
  Space,
  Modal,
  message,
  Descriptions,
  Typography
} from 'antd'
import {
  DownloadOutlined,
  CloudUploadOutlined,
  CloudDownloadOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined
} from '@ant-design/icons'

const { Text } = Typography

/**
 * Settings 组件 -- 应用设置页面
 *
 * 页面分为四个卡片区域：数据导出、备份恢复、危险操作、关于信息。
 * 每个操作都有二次确认，防止用户误操作。
 * 危险操作使用红色主题，从视觉上警示用户。
 */
function Settings(): JSX.Element {
  /**
   * loading 状态 -- 记录当前正在执行的操作
   * 用字符串而不是布尔值，因为有两个按钮可能同时显示加载状态。
   * null=无操作 'csv'=导出中 'backup'=备份中
   */
  const [loading, setLoading] = useState<string | null>(null)

  /**
   * handleExportCSV -- 导出账单为 CSV 文件
   * CSV 是通用表格格式，可用 Excel、WPS 等打开。
   * 执行：设置 loading -> 调用后端 API -> 显示结果路径
   */
  const handleExportCSV = async (): Promise<void> => {
    setLoading('csv')
    const result = await window.api.exportCSV()
    setLoading(null)
    if (result.success) {
      message.success(`账单已导出到：${result.path}`)
    }
  }

  /**
   * handleBackup -- 备份整个数据库
   * 把当前数据库文件复制一份存到用户指定位置。
   * 建议：重装系统前、换电脑前、定期备份。
   */
  const handleBackup = async (): Promise<void> => {
    setLoading('backup')
    const result = await window.api.backupDatabase()
    setLoading(null)
    if (result.success) {
      message.success(`数据库已备份到：${result.path}`)
    }
  }

  /**
   * handleRestore -- 从备份文件恢复数据
   * 用备份文件替换当前数据库，会覆盖当前所有数据。
   * 恢复后需重启应用以刷新数据。
   */
  const handleRestore = (): void => {
    Modal.confirm({
      title: '确认恢复数据',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <Text type="warning">
            恢复数据将<Text strong>覆盖</Text>当前所有数据，此操作不可撤销！
          </Text>
          <br />
          <Text style={{ fontSize: 12, color: '#8c8c8c', marginTop: 8 }}>
            建议先备份当前数据再恢复。
          </Text>
        </div>
      ),
      okText: '我已了解，继续恢复',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        const result = await window.api.restoreDatabase()
        if (result.success) {
          message.success('数据已恢复，请重启应用以刷新数据')
        }
      }
    })
  }

  /**
   * handleClear -- 清空所有数据（最危险的操作）
   * 永久删除所有账单和分类数据，不可撤销。
   * 安全措施：二次确认、红色按钮、建议先备份。
   */
  const handleClear = (): void => {
    Modal.confirm({
      title: '确认清空数据',
      // ExclamationCircleOutlined 黄色感叹号图标=重要操作提示
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          {/* type="danger" 将文字显示为红色 */}
          <Text type="danger">
            此操作将<Text strong>永久删除</Text>所有账单数据，不可恢复！
          </Text>
          <br />
          <Text style={{ fontSize: 12, color: '#8c8c8c', marginTop: 8 }}>
            建议先导出 CSV 或备份数据库。
          </Text>
        </div>
      ),
      okText: '确认清空',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        await window.api.clearAllData()
        message.success('所有数据已清空')
      }
    })
  }

  return (
    <div>
      <h2 className="page-title">⚙️ 设置</h2>

      {/* Data Export */}
      <Card title="📥 数据导出" style={{ marginBottom: 24 }}>
        <Descriptions column={1} style={{ marginBottom: 16 }}>
          <Descriptions.Item label="功能说明">
            将全部账单导出为 CSV 文件，可用 Excel 打开查看。
          </Descriptions.Item>
          <Descriptions.Item label="包含内容">
            日期、一级分类、二级分类、金额、备注
          </Descriptions.Item>
        </Descriptions>
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          onClick={handleExportCSV}
          loading={loading === 'csv'}
        >
          导出 CSV
        </Button>
      </Card>

      {/* Backup & Restore */}
      <Card title="💿 数据备份与恢复" style={{ marginBottom: 24 }}>
        <Descriptions column={1} style={{ marginBottom: 16 }}>
          <Descriptions.Item label="备份">
            将整个数据库文件复制到您指定的位置保存。
          </Descriptions.Item>
          <Descriptions.Item label="恢复">
            从之前备份的数据库文件恢复，<Text type="warning">会覆盖当前数据</Text>。
          </Descriptions.Item>
        </Descriptions>
        <Space>
          <Button
            icon={<CloudUploadOutlined />}
            onClick={handleBackup}
            loading={loading === 'backup'}
          >
            备份数据库
          </Button>
          <Button
            icon={<CloudDownloadOutlined />}
            onClick={handleRestore}
            danger
          >
            恢复数据
          </Button>
        </Space>
      </Card>

      {/* Danger Zone */}
      <Card
        title="⚠️ 危险操作"
        style={{ borderColor: '#ff4d4f' }}
        styles={{ header: { borderColor: '#ff4d4f' } }}
      >
        <Descriptions column={1} style={{ marginBottom: 16 }}>
          <Descriptions.Item label="数据清空">
            <Text type="danger">永久删除所有账单数据，此操作不可撤销。</Text>
          </Descriptions.Item>
          <Descriptions.Item label="建议">
            操作前请先导出 CSV 或备份数据库，以防误删。
          </Descriptions.Item>
        </Descriptions>
        <Button
          type="primary"
          danger
          icon={<DeleteOutlined />}
          onClick={handleClear}
        >
          清空所有数据
        </Button>
      </Card>

      {/* Info */}
      <Card style={{ marginTop: 24 }}>
        <Descriptions column={1} size="small">
          <Descriptions.Item label="应用名称">黑马记账</Descriptions.Item>
          <Descriptions.Item label="数据存储">
            数据存储在您电脑本地，不会上传到任何服务器。
          </Descriptions.Item>
          <Descriptions.Item
            label={
              <Space>
                <InfoCircleOutlined />
                隐私说明
              </Space>
            }
          >
            本应用完全离线运行，您的所有记账数据仅存储在您的电脑中。
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  )
}

export default Settings
