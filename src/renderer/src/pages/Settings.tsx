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

function Settings(): JSX.Element {
  const [loading, setLoading] = useState<string | null>(null)

  const handleExportCSV = async (): Promise<void> => {
    setLoading('csv')
    const result = await window.api.exportCSV()
    setLoading(null)
    if (result.success) {
      message.success(`账单已导出到：${result.path}`)
    }
  }

  const handleBackup = async (): Promise<void> => {
    setLoading('backup')
    const result = await window.api.backupDatabase()
    setLoading(null)
    if (result.success) {
      message.success(`数据库已备份到：${result.path}`)
    }
  }

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

  const handleClear = (): void => {
    Modal.confirm({
      title: '确认清空数据',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
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
