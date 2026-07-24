/**
 * Home.tsx -- 首页概览
 * ====================================
 *
 * 用户打开应用后看到的第一个页面，相当于仪表盘。
 * 展示：今日支出、本月支出、全部笔数、快捷入口、最近账单。
 *
 * 使用 Promise.all 同时请求三份数据，提高加载速度。
 */

import { useState, useEffect } from 'react'
import { Card, Row, Col, Table, Tag } from 'antd'
import { useNavigate } from 'react-router-dom'
import { EditOutlined, AppstoreOutlined, PieChartOutlined } from '@ant-design/icons'
import type { BillRecord } from '../types/electron'
import dayjs from 'dayjs'

/**
 * Home 组件 -- 首页概览
 * 分为三个区域：顶部统计卡片、中部快捷入口、底部最近账单。
 */
function Home(): JSX.Element {
  // useNavigate 是路由导航功能，类似于网页超链接
  const navigate = useNavigate()
  /**
   * 四个核心状态：todayTotal=今日支出 monthTotal=本月支出
   * recentBills=最近10条账单 loading=加载状态
   */
  const [todayTotal, setTodayTotal] = useState(0)
  const [monthTotal, setMonthTotal] = useState(0)
  const [recentBills, setRecentBills] = useState<BillRecord[]>([])
  const [loading, setLoading] = useState(true)

  /**
   * useEffect -- 页面加载时自动执行
   * 空数组[]=只在第一次打开时运行，Promise.all并行加载提高速度。
   */
  useEffect(() => {
    /** load函数 -- 并行加载今日总额、本月总额、全部账单 */
    const load = async (): Promise<void> => {
      const now = dayjs()
      // Promise.all 让三个请求同时发出
      const [today, month, bills] = await Promise.all([
        window.api.getTodayTotal(),
        // dayjs的month()从0开始，0=1月，所以要+1
        window.api.getMonthTotal(now.year(), now.month() + 1),
        window.api.getBills()
      ])
      setTodayTotal(today)
      setMonthTotal(month)
      // 首页只展示最近10条
      setRecentBills(bills.slice(0, 10))
      setLoading(false)
    }
    load()
  }, []) // 空依赖=只执行一次

  /**
   * columns -- 表格列定义（日期、分类、金额、备注）
   * 定义在组件内部是为了访问 navigate 闭包变量。
   */
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
      // align:'right' 让金额右对齐
      align: 'right' as const,
      render: (v: number) => (
        <span style={{ fontWeight: 600, color: '#ff4d4f' }}>¥ {v.toFixed(2)}</span>
      )
    },
    {
      title: '备注',
      dataIndex: 'note',
      key: 'note',
      // ellipsis 过长自动省略号；备注为空显示占位符
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
