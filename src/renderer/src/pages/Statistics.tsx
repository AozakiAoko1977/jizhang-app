import { useState, useEffect, useCallback } from 'react'
import {
  Card,
  Row,
  Col,
  DatePicker,
  Radio,
  Table,
  Empty,
  Spin,
  Segmented
} from 'antd'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { PieChart, BarChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import dayjs from 'dayjs'
import type { BillRecord } from '../types/electron'

// Register ECharts components
echarts.use([
  PieChart,
  BarChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  CanvasRenderer
])

interface CategoryStat {
  name: string
  amount: number
  percentage: number
}

interface MonthStats {
  total: number
  avgDaily: number
  recordDays: number
  billCount: number
  byCategory: CategoryStat[]
}

interface TrendData {
  month: string
  total: number
  byCategory: { name: string; amount: number }[]
}

function Statistics(): JSX.Element {
  const currentYear = dayjs().year()
  const currentMonth = dayjs().month() + 1

  const [viewMode, setViewMode] = useState<'month' | 'range'>('month')
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)
  const [stats, setStats] = useState<MonthStats | null>(null)
  const [trend, setTrend] = useState<TrendData[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedL1, setSelectedL1] = useState<string | null>(null)
  const [l2Details, setL2Details] = useState<{ name: string; amount: number }[]>([])

  const loadStats = useCallback(async () => {
    setLoading(true)
    try {
      if (viewMode === 'month') {
        const monthStats = await window.api.getMonthStats(selectedYear, selectedMonth)
        setStats(monthStats)
        const trendData = await window.api.getMonthlyTrend(selectedYear)
        setTrend(trendData)
      } else if (dateRange && dateRange[0] && dateRange[1]) {
        const rangeStats = await window.api.getRangeStats(
          dateRange[0].format('YYYY-MM-DD'),
          dateRange[1].format('YYYY-MM-DD')
        )
        setStats(rangeStats)
        setTrend([])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [viewMode, selectedYear, selectedMonth, dateRange])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  // Load L2 details when clicking a pie slice
  const loadL2Details = async (l1Name: string): Promise<void> => {
    setSelectedL1(l1Name)
    try {
      let bills: BillRecord[]
      if (viewMode === 'month') {
        bills = await window.api.getMonthBills(selectedYear, selectedMonth)
      } else if (dateRange && dateRange[0] && dateRange[1]) {
        bills = await window.api.getMonthBills(currentYear, currentMonth)
      } else {
        bills = []
      }

      const l2Map = new Map<string, number>()
      bills
        .filter((b) => b.category_l1 === l1Name)
        .forEach((b) => {
          l2Map.set(b.category_l2, (l2Map.get(b.category_l2) || 0) + b.amount)
        })

      setL2Details(
        Array.from(l2Map.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([name, amount]) => ({ name, amount }))
      )
    } catch {
      // ignore
    }
  }

  // Pie chart config
  const pieOption = stats
    ? {
        tooltip: {
          trigger: 'item' as const,
          formatter: (params: any): string =>
            `${params.name}<br/>¥${params.value.toFixed(2)} (${params.percent}%)`
        },
        legend: {
          orient: 'vertical' as const,
          right: 10,
          top: 'center',
          textStyle: { fontSize: 12 }
        },
        series: [
          {
            type: 'pie',
            radius: ['40%', '70%'],
            center: ['35%', '50%'],
            avoidLabelOverlap: false,
            label: {
              show: true,
              formatter: '{b}\n{d}%',
              fontSize: 11
            },
            emphasis: {
              label: { fontSize: 16, fontWeight: 'bold' }
            },
            data: stats.byCategory.map((c) => ({
              name: c.name,
              value: c.amount
            }))
          }
        ]
      }
    : {}

  // Bar chart config - monthly trend
  const barOption = trend.length
    ? {
        tooltip: {
          trigger: 'axis' as const,
          formatter: (params: any): string => {
            if (!params || !params.length) return ''
            return `${params[0].name}<br/>总支出: ¥${Number(params[0].value).toFixed(2)}`
          }
        },
        grid: { left: 50, right: 20, top: 20, bottom: 40 },
        xAxis: {
          type: 'category' as const,
          data: trend.map((t) => t.month.slice(5) + '月'),
          axisLabel: { fontSize: 11 }
        },
        yAxis: {
          type: 'value' as const,
          axisLabel: { formatter: (v: number): string => `¥${v}` }
        },
        series: [
          {
            type: 'bar',
            data: trend.map((t) => t.total),
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: '#1677ff' },
                { offset: 1, color: '#69b1ff' }
              ]),
              borderRadius: [4, 4, 0, 0]
            }
          }
        ]
      }
    : {}

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)

  return (
    <div>
      <h2 className="page-title">📊 统计分析</h2>

      {/* Filters */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col>
            <Segmented
              value={viewMode}
              onChange={(val) => setViewMode(val as 'month' | 'range')}
              options={[
                { label: '按月查看', value: 'month' },
                { label: '自定义范围', value: 'range' }
              ]}
            />
          </Col>
          {viewMode === 'month' ? (
            <>
              <Col>
                <DatePicker
                  picker="year"
                  value={dayjs().year(selectedYear)}
                  onChange={(d) => {
                    if (d) setSelectedYear(d.year())
                  }}
                  style={{ width: 100 }}
                />
              </Col>
              <Col>
                <Radio.Group
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  size="small"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <Radio.Button key={m} value={m}>
                      {m}月
                    </Radio.Button>
                  ))}
                </Radio.Group>
              </Col>
            </>
          ) : (
            <Col>
              <DatePicker.RangePicker
                value={dateRange as any}
                onChange={(dates) => {
                  if (dates && dates[0] && dates[1]) {
                    setDateRange([dates[0], dates[1]])
                  }
                }}
                format="YYYY-MM-DD"
              />
            </Col>
          )}
        </Row>
      </Card>

      <Spin spinning={loading}>
        {stats ? (
          <>
            {/* Summary Cards */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col span={6}>
                <Card className="stat-card">
                  <div className="stat-value" style={{ color: '#ff4d4f' }}>
                    ¥ {stats.total.toFixed(2)}
                  </div>
                  <div className="stat-label">总支出</div>
                </Card>
              </Col>
              <Col span={6}>
                <Card className="stat-card">
                  <div className="stat-value">¥ {stats.avgDaily.toFixed(2)}</div>
                  <div className="stat-label">日均支出</div>
                </Card>
              </Col>
              <Col span={6}>
                <Card className="stat-card">
                  <div className="stat-value">{stats.recordDays}</div>
                  <div className="stat-label">记账天数</div>
                </Card>
              </Col>
              <Col span={6}>
                <Card className="stat-card">
                  <div className="stat-value">{stats.billCount}</div>
                  <div className="stat-label">记账笔数</div>
                </Card>
              </Col>
            </Row>

            {/* Pie Chart */}
            <Card title="支出占比（按大类）" style={{ marginBottom: 24 }}>
              {stats.byCategory.length > 0 ? (
                <ReactEChartsCore
                  echarts={echarts}
                  option={pieOption}
                  style={{ height: 350 }}
                  onEvents={{
                    click: (params: any) => loadL2Details(params.name)
                  }}
                />
              ) : (
                <Empty description="暂无数据" />
              )}
              <div
                style={{
                  textAlign: 'center',
                  color: '#8c8c8c',
                  marginTop: 8,
                  fontSize: 12
                }}
              >
                💡 点击饼图可查看该大类的小类明细
              </div>
            </Card>

            {/* L2 Detail */}
            {selectedL1 && l2Details.length > 0 && (
              <Card
                title={`${selectedL1} - 小类明细`}
                style={{ marginBottom: 24 }}
                extra={
                  <a onClick={() => setSelectedL1(null)}>关闭</a>
                }
              >
                <Table
                  dataSource={l2Details}
                  rowKey="name"
                  size="small"
                  pagination={false}
                  columns={[
                    { title: '小类', dataIndex: 'name', key: 'name' },
                    {
                      title: '金额',
                      dataIndex: 'amount',
                      key: 'amount',
                      align: 'right' as const,
                      render: (v: number) => (
                        <span style={{ fontWeight: 600, color: '#ff4d4f' }}>
                          ¥ {v.toFixed(2)}
                        </span>
                      ),
                      sorter: (a: any, b: any) => a.amount - b.amount,
                      defaultSortOrder: 'descend' as const
                    }
                  ]}
                />
              </Card>
            )}

            {/* Monthly Trend Bar Chart */}
            {viewMode === 'month' && trend.length > 0 && (
              <Card title={`${selectedYear}年 各月支出趋势`}>
                <ReactEChartsCore
                  echarts={echarts}
                  option={barOption}
                  style={{ height: 300 }}
                />
              </Card>
            )}
          </>
        ) : (
          <Empty description="请选择日期范围查看统计" />
        )}
      </Spin>
    </div>
  )
}

export default Statistics
