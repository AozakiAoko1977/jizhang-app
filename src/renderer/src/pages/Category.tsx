/**
 * Category.tsx -- 分类管理页面
 * ====================================
 *
 * 管理记账的两级分类体系（大类->小类），支持查看、新增、编辑、删除分类。
 *
 * 分类采用两级结构：一级大类（餐饮、交通...）包含二级小类（三餐、外卖...）。
 * 删除分类时后端检查该分类下是否有账单，有则不允许删除。
 * 编辑分类时大类名称不可修改，防止数据混乱。
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Popconfirm,
  message,
  Space,
  Tag,
  Empty
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { CategoryGrouped, CategoryRecord } from '../types/electron'

/**
 * Category 组件 -- 分类管理页面
 */
function Category(): JSX.Element {
  const [categories, setCategories] = useState<CategoryGrouped[]>([])
  const [allCategories, setAllCategories] = useState<CategoryRecord[]>([])
  const [l1List, setL1List] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCat, setEditingCat] = useState<CategoryRecord | null>(null)
  const [form] = Form.useForm()
  const [newL1, setNewL1] = useState<string | undefined>(undefined)

  /**
   * loadData -- 同时加载三种格式的分类数据：
   * grouped=按大类分组(卡片展示) all=全部记录(查找) l1s=大类名称(下拉)
   */
  const loadData = useCallback(async () => {
    const [grouped, all, l1s] = await Promise.all([
      window.api.getCategoriesGrouped(),
      window.api.getCategories(),
      window.api.getL1Categories()
    ])
    setCategories(grouped)
    setAllCategories(all)
    setL1List(l1s)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  /**
   * handleAdd -- 打开新增分类弹窗，清空表单
   */
  const handleAdd = (): void => {
    setEditingCat(null)
    setNewL1(undefined)
    form.resetFields()
    setModalOpen(true)
  }

  /**
   * handleEdit -- 打开编辑分类弹窗，预填选中分类的数据
   */
  const handleEdit = (cat: CategoryRecord): void => {
    setEditingCat(cat)
    setNewL1(cat.name_l1)
    form.setFieldsValue({
      name_l1: cat.name_l1,
      name_l2: cat.name_l2
    })
    setModalOpen(true)
  }

  /**
   * handleDelete -- 删除分类，后端检查是否有账单，有则提示不能删除
   */
  const handleDelete = async (cat: CategoryRecord): Promise<void> => {
    const result = await window.api.deleteCategory({
      id: cat.id,
      name_l1: cat.name_l1,
      name_l2: cat.name_l2
    })
    if (result.success) {
      message.success('分类已删除')
      await loadData()
    } else {
      message.warning(result.reason || '无法删除')
    }
  }

  /**
   * handleSubmit -- 提交分类表单
   * editingCat=null时新增(addCategory)，否则编辑(updateCategory需传新旧值)
   * 编辑时传oldL1/oldL2和newL1/newL2，后端据此找到原记录并更新。
   */
  const handleSubmit = async (values: {
    name_l1: string
    name_l2: string
  }): Promise<void> => {
    setLoading(true)
    try {
      if (editingCat) {
        // Update
        await window.api.updateCategory({
          id: editingCat.id,
          oldL1: editingCat.name_l1,
          oldL2: editingCat.name_l2,
          newL1: values.name_l1,
          newL2: values.name_l2
        })
        message.success('分类已更新')
      } else {
        // Add
        await window.api.addCategory({
          name_l1: values.name_l1,
          name_l2: values.name_l2
        })
        message.success('分类已添加')
      }
      setModalOpen(false)
      await loadData()
    } catch (err: any) {
      message.error(err?.message || '操作失败')
    } finally {
      setLoading(false)
    }
  }

  /**
   * groupedColumns -- 以卡片形式展示每个大类及其下的小类标签
   */
  const groupedColumns = [
    {
      title: '一级分类',
      dataIndex: 'l1',
      key: 'l1',
      width: 180,
      render: (val: string) => (
        <span style={{ fontWeight: 600, fontSize: 15 }}>{val}</span>
      )
    },
    {
      title: '二级分类',
      dataIndex: 'l2',
      key: 'l2',
      render: (l2List: string[]) => (
        <Space wrap>
          {l2List.map((name) => {
            const full = allCategories.find(
              (c) => c.name_l1 === categories.find((g) => g.l2.includes(name))?.l1 && c.name_l2 === name
            )
            return (
              <Tag
                key={name}
                closable
                style={{ fontSize: 13, padding: '2px 8px' }}
                onClose={(e) => {
                  e.preventDefault()
                  if (full) handleDelete(full)
                }}
              >
                <span
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    if (full) handleEdit(full)
                  }}
                >
                  {name}
                </span>
              </Tag>
            )
          })}
        </Space>
      )
    }
  ]

  return (
    <div>
      <h2 className="page-title">📂 分类管理</h2>

      {/* Instruction + add button */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ color: '#8c8c8c' }}>
              共 {allCategories.length} 个分类（{l1List.length} 个大类）。点击标签可编辑，点击 ✕ 可删除。
            </span>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新增分类
          </Button>
        </div>
      </Card>

      {/* Grouped display */}
      {categories.map((group) => (
        <Card
          key={group.l1}
          title={
            <span style={{ fontSize: 16, fontWeight: 600 }}>{group.l1}</span>
          }
          style={{ marginBottom: 16 }}
          extra={
            <Button
              type="link"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingCat(null)
                setNewL1(group.l1)
                form.resetFields()
                form.setFieldValue('name_l1', group.l1)
                setModalOpen(true)
              }}
            >
              添加小类
            </Button>
          }
        >
          <Space wrap size={[8, 8]}>
            {group.l2.map((l2Name) => {
              const full = allCategories.find(
                (c) => c.name_l1 === group.l1 && c.name_l2 === l2Name
              )
              return (
                <Tag
                  key={l2Name}
                  color="blue"
                  style={{ fontSize: 14, padding: '4px 12px', cursor: 'pointer' }}
                  onClick={() => {
                    if (full) handleEdit(full)
                  }}
                >
                  {l2Name}
                  <DeleteOutlined
                    style={{ marginLeft: 6, fontSize: 11 }}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (full) handleDelete(full)
                    }}
                  />
                </Tag>
              )
            })}
            {group.l2.length === 0 && (
              <span style={{ color: '#ccc' }}>暂无小类</span>
            )}
          </Space>
        </Card>
      ))}

      {categories.length === 0 && <Empty description="暂无分类" />}

      {/* Modal for add/edit */}
      <Modal
        title={editingCat ? '编辑分类' : '新增分类'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="name_l1"
            label="一级大类"
            rules={[{ required: true, message: '请选择或输入大类名称' }]}
          >
            <Select
              mode="tags"
              maxCount={1}
              placeholder="选择已有大类，或输入新名称"
              options={l1List.map((l1) => ({ label: l1, value: l1 }))}
              onChange={(val) => setNewL1(val ? val[0] : undefined)}
              disabled={!!editingCat}
            />
          </Form.Item>

          <Form.Item
            name="name_l2"
            label="二级小类"
            rules={[{ required: true, message: '请输入小类名称' }]}
          >
            <Input placeholder="例如：早餐、地铁、话费" maxLength={20} />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              {editingCat ? '保存修改' : '添加分类'}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Category
