import { useState, useEffect } from 'react'
import { Card, Row, Col, Table, Tag } from 'antd'
import { useNavigate } from 'react-router-dom'
import { EditOutlined, AppstoreOutlined, PieChartOutlined } from '@ant-design/icons'
import type { BillRecord } from '../types/electron'
import dayjs from 'dayjs'

function Home(): JSX.Element {
  const navigate = useNavigate()
  const [todayTotal, setTodayTotal] = useState(0)
  const [monthTotal, setMonthTotal] = useState(0)
  const [recentBills, setRecentBills] = useState<BillRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async (): Promise<void> => {
      const now = dayjs()
      const [today, month, bills] = await Promise.all([
        window.api.getTodayTotal(),
        window.api.getMonthTotal(now.year(), now.month() + 1),
        window.api.getBills()
      ])
      setTodayTotal(today)
      setMonthTotal(month)
      setRecentBills(bills.slice(0, 10))
      setLoading(false)
    }
    load()
  }, [])

  const columns = [
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      width: 100
    },
    {
      title: '分类',
      key: 'category',
      width: 150,
      render: (_: unknown, r: BillRecord) => (
        <span>
          <Tag color="blue">{r.category_l1}</Tag>
          <span style={{ fontSize: 12, color: '#8c8c8c' }}>{r.category_l2}</span>
        </span>
      )
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right' as const,
      render: (v: number) => (
        <span style={{ fontWeight: 600, color: '#ff4d4f' }}>¥ {v.toFixed(2)}</span>
      )
    },
    {
      title: '备注',
      dataIndex: 'note',
      key: 'note',
      ellipsis: true,
      render: (v: string) => v || '-'
    }
  ]

  return (
    <div>
      <h2 className="page-title">📋 概览</h2>

      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Card className="stat-card" loading={loading}>
            <div className="stat-value">¥ {todayTotal.toFixed(2)}</div>
            <div className="stat-label">今日支出</div>
          </Card>
        </Col>
        <Col span={8}>
          <Card className="stat-card" loading={loading}>
            <div className="stat-value">¥ {monthTotal.toFixed(2)}</div>
            <div className="stat-label">{dayjs().format('M')}月支出</div>
          </Card>
        </Col>
        <Col span={8}>
          <Card className="stat-card" loading={loading}>
            <div className="stat-value">{recentBills.length}</div>
            <div className="stat-label">全部记账笔数</div>
          </Card>
        </Col>
      </Row>

      <h3 style={{ marginTop: 32, marginBottom: 16, fontSize: 18, fontWeight: 500 }}>快捷入口</h3>
      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Card hoverable style={{ textAlign: 'center' }} onClick={() => navigate('/record')}>
            <EditOutlined style={{ fontSize: 32, color: '#1677ff', marginBottom: 12 }} />
            <div style={{ fontSize: 16, fontWeight: 500 }}>记一笔</div>
          </Card>
        </Col>
        <Col span={8}>
          <Card hoverable style={{ textAlign: 'center' }} onClick={() => navigate('/category')}>
            <AppstoreOutlined style={{ fontSize: 32, color: '#52c41a', marginBottom: 12 }} />
            <div style={{ fontSize: 16, fontWeight: 500 }}>管理分类</div>
          </Card>
        </Col>
        <Col span={8}>
          <Card hoverable style={{ textAlign: 'center' }} onClick={() => navigate('/statistics')}>
            <PieChartOutlined style={{ fontSize: 32, color: '#fa8c16', marginBottom: 12 }} />
            <div style={{ fontSize: 16, fontWeight: 500 }}>查看统计</div>
          </Card>
        </Col>
      </Row>

      <h3 style={{ marginTop: 32, marginBottom: 16, fontSize: 18, fontWeight: 500 }}>最近账单</h3>
      <Card>
        <Table
          columns={columns}
          dataSource={recentBills}
          rowKey="id"
          size="middle"
          loading={loading}
          pagination={false}
          locale={{ emptyText: '还没有账单，点击"记一笔"开始记账吧 📝' }}
          onRow={() => ({
            onClick: () => navigate('/record'),
            style: { cursor: 'pointer' }
          })}
        />
      </Card>
    </div>
  )
}

export default Home
