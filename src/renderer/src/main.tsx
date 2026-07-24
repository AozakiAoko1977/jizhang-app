/**
 * main.tsx — React 应用入口文件
 * =====================================
 * 这个文件是整个前端（React 界面）的"启动按钮"。
 *
 * 它做了三件事：
 *   ① 找到 HTML 中的根节点（id="root" 的那个 <div>）
 *   ② 在根节点上挂载 React 应用
 *   ③ 给应用穿上三层"外套"：
 *      - ConfigProvider：Ant Design 的主题配置（颜色、圆角、字体）
 *      - AntApp：Ant Design 5.x 的全局消息/弹窗容器
 *      - HashRouter：前端路由（用 URL 的 # 号后面的部分来切换页面）
 *
 * 为什么要用 HashRouter 而不是 BrowserRouter？
 * Electron 加载的是本地文件（file:// 协议），BrowserRouter 依赖服务器
 * 来处理 URL，在本地文件环境下会出问题。HashRouter 用 # 号后面的
 * 路径来管理页面跳转，不依赖服务器，所以更适合 Electron 应用。
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { ConfigProvider, App as AntApp } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import App from './App'
import './App.css'

// 把 React 应用挂载到 HTML 页面的根节点（index.html 中的 <div id="root">）
ReactDOM.createRoot(document.getElementById('root')!).render(
  // StrictMode：React 的"严格模式"，开发时会对代码做额外检查，帮助发现潜在问题
  <React.StrictMode>
    {/* ConfigProvider — Ant Design 的全局配置中心
        这里设置了：中文语言包、主题色 #1677ff（蓝色）、圆角 6px、系统字体 */}
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#1677ff',       // 主色调（按钮、选中项等的颜色）
          borderRadius: 6,               // 全局圆角大小
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif"
        },
        // 针对特定组件的样式微调
        components: {
          Layout: {
            siderBg: '#001529',          // 侧边栏背景色（深蓝黑）
            headerBg: '#ffffff',         // 顶栏背景色（白色）
            headerHeight: 56             // 顶栏高度
          },
          Menu: {
            darkItemBg: '#001529',       // 菜单项背景色
            darkItemSelectedBg: '#1677ff' // 菜单项选中时的背景色（蓝色高亮）
          },
          Card: {
            borderRadiusLG: 8            // 卡片外圆角
          }
        }
      }}
    >
      {/* AntApp — Ant Design 5.x 的消息/弹窗容器，提供 message.success() 等全局方法 */}
      <AntApp>
        {/* HashRouter — 用 URL 的 # 号后面部分来切换页面，不依赖后台服务器 */}
        <HashRouter>
          <App />
        </HashRouter>
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>
)
