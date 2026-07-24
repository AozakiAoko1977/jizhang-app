/**
 * ============================================================
 * App.tsx —— 应用的"交通指挥中心"（根组件）
 * ============================================================
 *
 * 【文件作用】
 *   这个文件是整个应用的"入口大脑"，它只做一件事：
 *   根据用户点击的菜单项（或者说浏览器地址栏里的路径），
 *   决定该显示哪个页面。
 *
 * 【通俗比喻】
 *   把它想象成一个大楼的"前台引导员"：
 *   - 你走到前台说"我要去记账"  → 引导员带你到记账页面
 *   - 你走到前台说"我要看统计"  → 引导员带你到统计页面
 *   - 你刚进门还没说话        → 引导员默认带你去首页
 *
 * 【技术说明（给懂一点的人）】
 *   使用 react-router-dom 的 Routes/Route 组件定义路由规则。
 *   AppLayout 是外层壳（侧边栏+顶栏），所有页面都嵌在这个壳里面展示。
 *
 * 【路由一览表】
 *   路径          →  显示的页面        说明
 *   /             →  自动跳转到 /home   默认入口
 *   /home         →  Home              首页概览
 *   /record       →  Record            记账页面
 *   /category     →  Category          分类管理
 *   /statistics   →  Statistics        统计分析
 *   /settings     →  Settings          设置
 *   /snake        →  SnakeGame         贪吃蛇小游戏
 * ============================================================
 */

// ---- 引入路由相关的"遥控器" ----
// Routes  = 路由规则表的容器（相当于一本"导航手册"）
// Route   = 单条路由规则（手册里的一行：什么路径 → 显示什么页面）
// Navigate = 页面跳转指令（相当于"请跟我来"）
import { Routes, Route, Navigate } from 'react-router-dom'

// ---- 引入外层框架组件（侧边栏 + 顶栏 + 内容区的那个"壳"） ----
import AppLayout from './components/AppLayout'

// ---- 引入各个页面组件（用户实际看到的内容） ----
import Home from './pages/Home'             // 首页 / 今日概览
import Record from './pages/Record'         // 记账页（添加/编辑账单）
import Category from './pages/Category'     // 分类管理页
import Statistics from './pages/Statistics' // 统计分析页（图表）
import Settings from './pages/Settings'     // 设置页
import SnakeGame from './pages/SnakeGame'   // 贪吃蛇小游戏

/**
 * App 组件 —— 整个应用的根组件
 *
 * 这是 React 渲染的起点，其他所有东西都在它里面。
 * 它的工作流程：
 *   1. 用户打开应用
 *   2. 浏览器地址栏是 "/"
 *   3. App 看到 "/"，告诉路由："请把用户带到 /home"
 *   4. 路由把 Home 页面的内容塞进 AppLayout 的内容区
 *   5. 用户看到带侧边栏的首页
 */
function App(): JSX.Element {
  return (
    // <Routes> 是"路由规则表"，里面包含所有路径→页面的映射关系
    <Routes>
      {/*
         * 第一条（也是唯一一条）父路由：路径为 "/"
         * element={<AppLayout />} 的意思是：
         *   所有匹配到 "/" 开头的路径，都先套上 AppLayout 这个"壳"
         *   （壳 = 左侧菜单栏 + 顶部标题栏 + 中间内容区）
         *
         * 为什么要这样设计？
         *   因为整个应用几乎每个页面都需要侧边栏和顶栏，
         *   与其每个页面自己写一遍，不如写一个公共的"壳"，
         *   然后让子页面的内容自动填入壳的中间区域。
         *   这样改侧边栏只需要改一个地方，不用改六个页面。
         */}
      <Route path="/" element={<AppLayout />}>

        {/*
           * 子路由 1：index（索引路由）
           *   当用户路径正好是 "/"（刚进应用，还没点任何菜单），
           *   自动跳转到 "/home"，replace 表示"替换历史记录"，
           *   这样用户按"后退"不会回到一个空白页。
           */}
        <Route index element={<Navigate to="/home" replace />} />

        {/*
           * 子路由 2~7：各个功能页面
           *   路径是相对于父路由 "/" 的，所以 /home 实际匹配 /home
           *   每个 Route 绑定一个路径和一个页面组件
           *
           *   注意：这些路径的值必须和 AppLayout.tsx 中
           *   menuItems 的 key 值完全一致，否则点击菜单后
           *   侧边栏的高亮状态和实际显示的页面对不上。
           */}
        <Route path="home" element={<Home />} />             {/* 首页概览 */}
        <Route path="record" element={<Record />} />         {/* 记账页面 */}
        <Route path="category" element={<Category />} />     {/* 分类管理 */}
        <Route path="statistics" element={<Statistics />} /> {/* 统计分析 */}
        <Route path="settings" element={<Settings />} />     {/* 设置 */}
        <Route path="snake" element={<SnakeGame />} />       {/* 贪吃蛇小游戏 */}
      </Route>
    </Routes>
  )
}

// 导出 App 组件，让 main.tsx（React 的真正入口文件）可以使用它
export default App
