/**
 * Statistics.tsx — 统计分析页面
 * =====================================
 * 用图表展示支出数据，帮助用户了解"钱花在哪了"。
 *
 * 主要功能：
 *   ① 月度概览卡片（总支出、日均、记账天数、笔数）
 *   ② 饼图——按一级大类展示支出占比
 *   ③ 柱状图——全年各月支出趋势
 *   ④ 自定义日期范围筛选
 *   ⑤ 点击饼图扇区，深入查看该大类的小类明细
 *
 * 使用 ECharts 按需导入模式：只加载本页面用到的饼图和柱状图，
 * 打包体积从约 1MB 降到约 200KB（减少 80%）。
 */

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
// 使用 echarts-for-react 的"按需加载"模式（/lib/core），
// 而不是默认的 import ReactECharts from 'echarts-for-react'（会把整个 ECharts 打包进来）
import ReactEChartsCore from 'echarts-for-react/lib/core'
// 按需导入 ECharts 核心，而不是 import * as echarts from 'echarts'
// 好处：打包体积大幅减小。完整 ECharts 约 1MB，按需导入只需约 200KB
import * as echarts from 'echarts/core'
// 图表类型：只导入本页面用到的饼图（大类占比）和柱状图（月度趋势）
import { PieChart, BarChart } from 'echarts/charts'
// 组件：标题、提示框（鼠标悬停弹出信息）、图例（颜色说明）、
// 网格（柱状图的坐标轴区域）——也只导入用到的，不导入多余的
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
// Canvas 渲染器：ECharts 默认用 Canvas 画图（类似画画布），必须注册
import dayjs from 'dayjs'
import type { BillRecord } from '../types/electron'

// 把上面按需导入的"零件"注册到 ECharts 核心中
// 相当于告诉 ECharts："我只需要饼图、柱状图、提示框、图例、网格和 Canvas 渲染器，别加载别的"
// 如果不注册，图表不会渲染，控制台会报错
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

/**
   * 点击饼图扇区时，加载该大类下面的小类明细
   *
   * 工作流程：获取对应时间段的账单 → 筛选该大类 → 按小类汇总并排序
   *
   * ⚠️ FIXME：第 131 行在 'range' 模式下调用的是 getMonthBills(currentYear, currentMonth)
   * 而不是根据 dateRange 来查询。这意味着自定义日期范围时点击饼图，
   * 显示的可能是当前月的小类明细，而非所选日期范围的明细。
   * 应该改为：取 dateRange 的起止日期，传给 getStatsByDateRange 或用合适的方式查询。
   */
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

  /**
   * 饼图（环形图）配置 — 展示各大类支出占比
   *
   * 关键 ECharts 配置解释：
   *   tooltip.trigger='item' — 鼠标悬停在某个扇区上弹出信息
   *   legend.orient='vertical' — 图例竖排显示（省横向空间）
   *   radius: ['40%', '70%'] — 内半径 40% + 外半径 70% = 环形图（不是实心圆）
   *   center: ['35%', '50%'] — 图往左偏一点，给右边的图例腾空间
   *   formatter: '{b}\n{d}%' — 扇区标签："大类名 换行 百分比"
   *   emphasis — 鼠标悬停时标签变大加粗
   */
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

  /**
   * 柱状图配置 — 展示全年各月支出趋势
   *
   * 关键 ECharts 配置解释：
   *   tooltip.trigger='axis' — 鼠标悬停在柱子上方弹出信息框
   *   grid — 图表四边留白（left:50 给 Y 轴标签留位置）
   *   xAxis.data — X 轴标签，从 "2026-07" 截取后两位变 "07月"
   *   itemStyle.color — 渐变色：从深蓝 (#1677ff) 渐变到浅蓝 (#69b1ff)
   *     new echarts.graphic.LinearGradient(0,0,0,1, [...])
   *     参数含义：x1,y1,x2,y2 = 方向从顶部(0,0)到底部(0,1)的垂直渐变
   *   borderRadius: [4,4,0,0] — 柱子顶部圆角 4px，底部直角
   */
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

  /** 年份选项列表：当前年 ± 2 年，共 5 年 */
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)

  return (
    <div>
      <h2 className="page-title">📊 统计分析</h2>

      {/* ===== 筛选条件区 ===== */}
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
            {/* ===== 四张统计概览卡片 ===== */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              {/* 总支出 — 红色数字突出显示 */}
              <Col span={6}>
                <Card className="stat-card">
                  <div className="stat-value" style={{ color: '#ff4d4f' }}>
                    ¥ {stats.total.toFixed(2)}
                  </div>
                  <div className="stat-label">总支出</div>
                </Card>
              </Col>
              {/* 日均支出 = 总支出 ÷ 当月天数 */}
              <Col span={6}>
                <Card className="stat-card">
                  <div className="stat-value">¥ {stats.avgDaily.toFixed(2)}</div>
                  <div className="stat-label">日均支出</div>
                </Card>
              </Col>
              {/* 有多少天记了账（同一天记多笔只算 1 天） */}
              <Col span={6}>
                <Card className="stat-card">
                  <div className="stat-value">{stats.recordDays}</div>
                  <div className="stat-label">记账天数</div>
                </Card>
              </Col>
              {/* 一共记了多少笔账单 */}
              <Col span={6}>
                <Card className="stat-card">
                  <div className="stat-value">{stats.billCount}</div>
                  <div className="stat-label">记账笔数</div>
                </Card>
              </Col>
            </Row>

            {/* ===== 饼图：大类支出占比 ===== */}
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

            {/* ===== 小类明细表：点击饼图扇区后展示 ===== */}
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

            {/* ===== 柱状图：全年月度趋势（仅在"按月查看"模式下展示）===== */}
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
