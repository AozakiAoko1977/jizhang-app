import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu } from 'antd'
import {
  HomeOutlined,
  EditOutlined,
  AppstoreOutlined,
  PieChartOutlined,
  SettingOutlined,
  BugOutlined
} from '@ant-design/icons'

const { Sider, Header, Content } = Layout

const menuItems = [
  { key: '/home', icon: <HomeOutlined />, label: '首页' },
  { key: '/record', icon: <EditOutlined />, label: '记账' },
  { key: '/category', icon: <AppstoreOutlined />, label: '分类管理' },
  { key: '/statistics', icon: <PieChartOutlined />, label: '统计分析' },
  { key: '/snake', icon: <BugOutlined />, label: '贪吃蛇' },
  { key: '/settings', icon: <SettingOutlined />, label: '设置' }
]

function AppLayout(): JSX.Element {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const selectedKey = '/' + location.pathname.split('/')[1]

  return (
    <Layout style={{ height: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 10
        }}
      >
        <div className="logo-container">
          <span className="logo-text">{collapsed ? '🐴' : '🐴 黑马记账'}</span>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : 200, transition: 'margin-left 0.2s' }}>
        <Header
          style={{
            padding: '0 24px',
            background: '#fff',
            fontSize: 16,
            fontWeight: 500,
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          黑马记账
        </Header>
        <Content className="page-container">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}

export default AppLayout
