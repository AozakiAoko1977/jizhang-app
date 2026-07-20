import { useState, useEffect, useCallback } from 'react'
import {
  Card,
  Form,
  Input,
  Select,
  DatePicker,
  Button,
  Table,
  Popconfirm,
  message,
  Space,
  Tag
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { BillRecord, CategoryGrouped } from '../types/electron'
import dayjs from 'dayjs'

function Record(): JSX.Element {
  const [form] = Form.useForm()
  const [categories, setCategories] = useState<CategoryGrouped[]>([])
  const [bills, setBills] = useState<BillRecord[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedL1, setSelectedL1] = useState<string | undefined>(undefined)

  const loadData = useCallback(async () => {
    const [cats, billList] = await Promise.all([
      window.api.getCategoriesGrouped(),
      window.api.getBills()
    ])
    setCategories(cats)
    setBills(billList)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const l2Options = selectedL1
    ? categories.find((c) => c.l1 === selectedL1)?.l2.map((name) => ({ label: name, value: name })) ??
      []
    : []

  const handleSubmit = async (values: {
    amount: number
    category_l1: string
    category_l2: string
    date: dayjs.Dayjs
    note?: string
  }): Promise<void> => {
    setLoading(true)
    try {
      const billData = {
        amount: values.amount,
        category_l1: values.category_l1,
        category_l2: values.category_l2,
        date: values.date.format('YYYY-MM-DD'),
        note: values.note || ''
      }

      if (editingId !== null) {
        await window.api.updateBill({ ...billData, id: editingId })
        message.success('账单已更新')
        setEditingId(null)
      } else {
        await window.api.addBill(billData)
        message.success('记账成功！')
      }

      form.resetFields()
      setSelectedL1(undefined)
      await loadData()
    } catch (err) {
      message.error('操作失败，请重试')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (bill: BillRecord): void => {
    setEditingId(bill.id)
    setSelectedL1(bill.category_l1)
    form.setFieldsValue({
      amount: bill.amount,
      category_l1: bill.category_l1,
      category_l2: bill.category_l2,
      date: dayjs(bill.date),
      note: bill.note
    })
  }

  const handleCancelEdit = (): void => {
    setEditingId(null)
    setSelectedL1(undefined)
    form.resetFields()
  }

  const handleDelete = async (id: number): Promise<void> => {
    await window.api.deleteBill(id)
    message.success('账单已删除')
    await loadData()
  }

  const columns = [
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      width: 110,
      sorter: (a: BillRecord, b: BillRecord) => a.date.localeCompare(b.date)
    },
    {
      title: '分类',
      key: 'category',
      width: 160,
      render: (_: unknown, record: BillRecord) => (
        <span>
          <Tag color="blue">{record.category_l1}</Tag>
          <span style={{ color: '#8c8c8c' }}>{record.category_l2}</span>
        </span>
      )
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      align: 'right' as const,
      render: (val: number) => (
        <span style={{ fontWeight: 600, color: '#ff4d4f' }}>¥ {val.toFixed(2)}</span>
      ),
      sorter: (a: BillRecord, b: BillRecord) => a.amount - b.amount
    },
    {
      title: '备注',
      dataIndex: 'note',
      key: 'note',
      ellipsis: true,
      render: (val: string) => val || '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_: unknown, record: BillRecord) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这条账单吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div>
      <h2 className="page-title">✏️ {editingId !== null ? '编辑账单' : '记一笔'}</h2>

      <Card style={{ marginBottom: 24 }}>
        <Form
          form={form}
          layout="inline"
          onFinish={handleSubmit}
          style={{ flexWrap: 'wrap', gap: 12 }}
          initialValues={{ date: dayjs() }}
        >
          <Form.Item
            name="amount"
            rules={[{ required: true, message: '请输入金额' }]}
          >
            <Input
              type="number"
              prefix="¥"
              placeholder="金额"
              style={{ width: 130 }}
              min={0.01}
              step={0.01}
            />
          </Form.Item>

          <Form.Item
            name="category_l1"
            rules={[{ required: true, message: '请选择大类' }]}
          >
            <Select
              placeholder="一级分类"
              style={{ width: 140 }}
              onChange={(val) => {
                setSelectedL1(val)
                form.setFieldValue('category_l2', undefined)
              }}
              options={categories.map((c) => ({ label: c.l1, value: c.l1 }))}
            />
          </Form.Item>

          <Form.Item
            name="category_l2"
            rules={[{ required: true, message: '请选择小类' }]}
          >
            <Select
              placeholder="二级分类"
              style={{ width: 140 }}
              options={l2Options}
              disabled={!selectedL1}
            />
          </Form.Item>

          <Form.Item
            name="date"
            rules={[{ required: true, message: '请选择日期' }]}
          >
            <DatePicker style={{ width: 150 }} format="YYYY-MM-DD" />
          </Form.Item>

          <Form.Item name="note">
            <Input placeholder="备注（可选）" style={{ width: 200 }} maxLength={100} />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              icon={editingId !== null ? undefined : <PlusOutlined />}
              loading={loading}
            >
              {editingId !== null ? '保存修改' : '记一笔'}
            </Button>
            {editingId !== null && (
              <Button style={{ marginLeft: 8 }} onClick={handleCancelEdit}>
                取消
              </Button>
            )}
          </Form.Item>
        </Form>
      </Card>

      <Card title={`全部账单（${bills.length} 条）`}>
        <Table
          columns={columns}
          dataSource={bills}
          rowKey="id"
          size="middle"
          pagination={{ pageSize: 20, showSizeChanger: false, showTotal: (t) => `共 ${t} 条` }}
          locale={{ emptyText: '还没有账单，快去记一笔吧 📝' }}
        />
      </Card>
    </div>
  )
}

export default Record
