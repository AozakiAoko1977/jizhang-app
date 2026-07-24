/**
 * ============================================================
 * AppLayout.tsx -- 应用的"外壳框架"（侧边栏 + 顶栏 + 内容区）
 * ============================================================
 *
 * 【文件作用】
 *   这个文件定义了整个应用的"骨架"——也就是你每次打开应用都会看到的
 *   左侧菜单栏、顶部标题栏、以及中间那块用来显示各个页面内容的区域。
 *   不管是首页、记账页、统计页，它们都"住"在这个壳里面。
 *
 * 【通俗比喻】
 *   把它想象成一个"手机壳"：
 *   - 左侧菜单栏 = 壳的边框（始终在那，帮你快速切换功能）
 *   - 顶部标题栏 = 壳顶部的 logo（告诉你这是"黑马记账"）
 *   - 中间内容区 = 壳里面装的手机（点不同菜单，这里显示不同页面）
 *   - 壳可以折叠 = 侧边栏可以收起来，给内容区腾更多空间
 *
 * 【布局结构（从左到右，从上到下）】
 *   +------------------------------------------+
 *   |          |  顶部标题栏（Header）           |
 *   |  侧边栏  +-------------------------------+
 *   | (Sider) |                               |
 *   |          |  内容区（Content）              |
 *   |  Logo   |  <-- 子页面的内容在这里显示     |
 *   |  + 菜单  |                               |
 *   +----------+-------------------------------+
 *
 * 【使用的技术】
 *   - Ant Design 的 Layout 组件（Sider / Header / Content）
 *   - Ant Design 的 Menu 组件（侧边栏菜单项）
 *   - react-router-dom 的 Outlet（子页面内容占位符）
 * ============================================================
 */

// ---- React 基础工具 ----
// useState：让组件拥有"记忆"（比如记住侧边栏是展开还是折叠）
import { useState } from 'react'

// ---- 路由相关工具 ----
// Outlet：子页面的"插槽"，子路由的内容会自动填到这个位置
// useNavigate：页面跳转的遥控器（点菜单项后跳转到对应页面）
// useLocation：读取当前浏览器地址栏的路径（用来高亮当前菜单项）
import { Outlet, useNavigate, useLocation } from 'react-router-dom'

// ---- UI 组件库 ----
// Layout：页面布局容器，提供 Sider（侧边栏）、Header（顶栏）、Content（内容区）
// Menu：侧边栏的导航菜单
import { Layout, Menu } from 'antd'

// ---- 图标库 ----
// 每个菜单项前面的小图标，让菜单看起来更直观
import {
  HomeOutlined,       // 首页图标
  EditOutlined,       // 记账图标
  AppstoreOutlined,   // 分类管理图标
  PieChartOutlined,   // 统计分析图标
  SettingOutlined,    // 设置图标
  BugOutlined         // 贪吃蛇图标（小虫子代表贪吃蛇很形象）
} from '@ant-design/icons'

// ---- 从 Layout 中解构出三个子组件，方便后面直接使用 ----
// Sider：左侧可折叠的侧边栏
// Header：顶部的标题栏
// Content：中间显示子页面内容的主区域
const { Sider, Header, Content } = Layout

/**
 * menuItems -- 侧边栏菜单的配置列表
 *
 * 这个数组定义了侧边栏的每一项菜单：
 * - key：菜单项对应的路径（点击后跳转到这个路径）
 *   注意：这里的 key 值必须和 App.tsx 中 Route 的 path 值完全相同！
 * - icon：菜单项前面的小图标（增加视觉辨识度）
 * - label：菜单项显示的文字（用户看到的中文名称）
 *
 * 如果要增加一个新页面，需要同时做三件事：
 *   1. 在这里加一个菜单项
 *   2. 在 App.tsx 中加一条 Route
 *   3. 创建对应的页面组件文件
 */
const menuItems = [
  { key: '/home', icon: <HomeOutlined />, label: '首页' },           // 第 1 项：首页概览
  { key: '/record', icon: <EditOutlined />, label: '记账' },         // 第 2 项：记账
  { key: '/category', icon: <AppstoreOutlined />, label: '分类管理' }, // 第 3 项：分类管理
  { key: '/statistics', icon: <PieChartOutlined />, label: '统计分析' }, // 第 4 项：统计分析
  { key: '/snake', icon: <BugOutlined />, label: '贪吃蛇' },         // 第 5 项：贪吃蛇小游戏
  { key: '/settings', icon: <SettingOutlined />, label: '设置' }     // 第 6 项：设置
]

/**
 * AppLayout 组件 -- 整个应用的"外壳框架"
 *
 * 这个组件做了以下几件事：
 *   1. 左侧显示可折叠的菜单栏（Sider）
 *      - 顶部显示 Logo（展开时显示完整名称，折叠时只显示图标）
 *      - 下方是菜单项列表，点击可跳转到对应页面
 *      - 菜单栏可以点击按钮折叠/展开
 *   2. 顶部显示标题栏（Header）-- 写着"黑马记账"
 *   3. 中间显示子页面内容（Content + Outlet）
 *      - Outlet 是一个"占位符"，子路由对应的页面内容会自动替换它
 */
function AppLayout(): JSX.Element {

  // ============================================================
  // 状态与路由变量
  // ============================================================

  /**
   * collapsed -- 侧边栏是否折叠
   * 初始值 false：侧边栏默认展开
   * 用户点击侧边栏底部的折叠按钮后，这个值会在 true/false 之间切换
   * 折叠后侧边栏变窄（只显示图标），给右边内容区腾出更多空间
   */
  const [collapsed, setCollapsed] = useState(false)

  /**
   * navigate -- 页面跳转函数
   * 相当于一个"遥控器"，调用 navigate 就能跳转到指定页面
   * 当用户点击菜单项时，用它来切换页面
   */
  const navigate = useNavigate()

  /**
   * location -- 当前浏览器地址信息
   * location.pathname 是当前的路径
   * 我们用这个信息来判断当前在哪个页面，从而高亮对应的菜单项
   */
  const location = useLocation()

  /**
   * selectedKey -- 计算当前应该高亮哪个菜单项
   *
   * 计算逻辑：
   *   location.pathname 可能是完整路径
   *   用 split 方法按斜杠分割路径，取索引为 1 的那一段（即第一级路径）
   *   然后前面加上斜杠拼成完整路径
   *
   * 举例：
   *   当前路径 "/statistics" -> selectedKey = "/statistics"
   *   当前路径 "/record/123"  -> selectedKey = "/record"
   *   当前路径 "/home"         -> selectedKey = "/home"
   *
   * 这个值传给 Menu 的 selectedKeys 属性，Ant Design 会自动高亮对应菜单项
   */
  const selectedKey = '/' + location.pathname.split('/')[1]

  // ============================================================
  // 页面渲染
  // ============================================================
  return (
    // 最外层 Layout：整个页面的根容器，高度设为 100vh 表示占满整个窗口
    <Layout style={{ height: '100vh' }}>

      {/*
         * ============================================
         * 左侧：可折叠的侧边栏（Sider）
         * ============================================
         *
         * 属性说明：
         * - collapsible：允许用户折叠/展开侧边栏（底部显示箭头按钮）
         * - collapsed：当前是折叠还是展开
         *   折叠=true/只显示图标，展开=false/显示图标+文字
         * - onCollapse：当用户点击折叠按钮时，调用 setCollapsed 更新状态
         * - position: fixed：让侧边栏固定在屏幕左边，滚动页面时它始终不动
         * - zIndex: 10：确保侧边栏在其他内容的上层（防止被内容遮挡）
         */}
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        style={{
          overflow: 'auto',       // 如果菜单项太多，允许侧边栏内部滚动
          height: '100vh',        // 高度占满整个窗口
          position: 'fixed',      // 固定在屏幕上，不随页面滚动
          left: 0,                // 紧贴屏幕左边
          top: 0,                 // 紧贴屏幕顶部
          bottom: 0,              // 紧贴屏幕底部
          zIndex: 10              // 层级设为 10，确保不被其他内容盖住
        }}
      >
        {/*
           * ---- Logo 区域 ----
           * 根据 collapsed 状态显示不同内容：
           * - 折叠时：只显示表情符号
           * - 展开时：显示 Logo + 应用名称
           */}
        <div className="logo-container">
          <span className="logo-text">{collapsed ? '🐴' : '🐴 黑马记账'}</span>
        </div>

        {/*
           * ---- 导航菜单 ----
           *
           * theme="dark"：深色主题（黑底白字，和侧边栏风格统一）
           * mode="inline"：垂直排列的菜单模式（常规侧边栏样式）
           * selectedKeys：当前选中的菜单项 key，用于高亮
           *   注意这里传的是数组 [selectedKey]，因为 Menu 组件要求数组格式
           * items：菜单项配置列表（上面定义的 menuItems 数组）
           * onClick：当用户点击某个菜单项时触发
           *   -> 拿到被点击项的 key
           *   -> 调用 navigate(key) 跳转到对应页面
           */}
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>

      {/*
         * ============================================
         * 右侧：主内容区域（顶栏 + 内容区）
         * ============================================
         *
         * marginLeft：根据侧边栏的折叠状态动态调整左边距
         * - 展开时：marginLeft = 200（侧边栏宽度是 200px，给侧边栏让出空间）
         * - 折叠时：marginLeft = 80（折叠后侧边栏宽度约 80px）
         * - transition：让边距变化有 0.2 秒的动画过渡，看起来更流畅
         */}
      <Layout style={{ marginLeft: collapsed ? 80 : 200, transition: 'margin-left 0.2s' }}>

        {/*
           * ---- 顶部标题栏（Header） ----
           *
           * 始终显示"黑马记账"，背景为白色，底部有浅灰色分割线。
           * 样式说明：
           * - padding：左右各留 24px 内边距，让文字不贴边
           * - background：白色背景
           * - fontSize: 16：字号 16px
           * - fontWeight: 500：中等加粗（不粗不细，刚好）
           * - borderBottom：底部浅灰色分割线，把标题栏和内容区分开
           * - display: flex + alignItems: center：让文字垂直居中
           */}
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

        {/*
           * ---- 主内容区（Content） ----
           *
           * className="page-container"：使用 App.css 中定义的样式
           *   （通常包含内边距、背景色、最小高度等设置）
           *
           * <Outlet />：子页面的"插槽"
           *   这个组件是 react-router-dom 提供的占位标记。
           *   路由系统会根据当前的路径，自动把对应的子页面
           *   组件渲染到 Outlet 的位置。
           *
           *   打个比方：
           *   Outlet 就像电视机屏幕，路由系统就是遥控器。
           *   你按"记账"按钮 -> 屏幕切到记账节目（Record 组件）
           *   你按"统计"按钮 -> 屏幕切到统计节目（Statistics 组件）
           *   屏幕还是那个屏幕，里面播的内容换了。
           */}
        <Content className="page-container">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}

// 导出 AppLayout 组件，让 App.tsx 可以使用它
export default AppLayout
