# 🐴 黑马记账

一款跨平台桌面端个人记账应用，帮助用户轻松记录和管理日常开销（人民币），
支持两级分类的收支管理，提供消费统计与数据分析功能。

支持 **Windows** 和 **macOS**。

---

## ✨ 功能特性

- **📝 记账管理** — 记录金额、两级分类、日期、备注，支持增删改查
- **📂 分类体系** — 预设 10 大类 40+ 小类，开箱即用，也可自定义
- **📊 统计分析** — 月度概览、饼图占比、柱状图对比、日期筛选
- **💾 数据管理** — CSV 导出、数据库备份与恢复，数据完全在本地

---

## 🖥️ 界面预览

> 截图待补充

---

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Electron |
| 前端 | React + TypeScript |
| UI 组件库 | Ant Design |
| 图表 | ECharts |
| 数据库 | SQLite（sql.js） |
| 构建工具 | electron-vite + Vite |
| 打包工具 | electron-builder |

---

## 🚀 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) 18 或以上
- npm（随 Node.js 一起安装）

### 安装与运行

```bash
# 1. 克隆项目
git clone https://github.com/AozakiAoko1977/jizhang-app.git
cd jizhang-app

# 2. 安装依赖
npm install

# 3. 启动开发模式
npm run dev
```

### 构建与打包

```bash
# 构建生产版本
npm run build

# 打包 Windows（生成 ZIP，在 release/ 目录下）
npm run pack:win

# 打包 macOS（需在 Mac 上执行，生成 DMG）
npm run pack:mac
```

---

## 📁 项目结构

```
src/
├── main/              # Electron 主进程
│   ├── index.ts       # 主进程入口，窗口管理
│   └── database.ts   # SQLite 数据库操作
├── preload/
│   └── index.ts       # 预加载脚本（主进程与渲染进程通信桥梁）
└── renderer/          # React 前端界面
    └── src/
        ├── App.tsx                     # 根组件（路由配置）
        ├── components/AppLayout.tsx    # 侧边栏导航布局
        └── pages/
            ├── Home.tsx       # 首页/今日概览
            ├── Record.tsx     # 记账页（账单列表 + 记一笔）
            ├── Category.tsx   # 分类管理
            ├── Statistics.tsx # 统计图表
            └── Settings.tsx   # 设置/数据管理
```

---

## 📖 记账分类

应用预设了 **10 个一级分类**，每个大类下包含若干小类：

| 大类 | 小类 |
|------|------|
| 🍜 餐饮 | 三餐、零食、饮品、外卖、聚餐 |
| 🚗 交通 | 公交地铁、打车、加油、停车、高铁/机票 |
| 🛒 购物 | 日用品、服饰、数码、家居、美妆 |
| 🏠 住房 | 房租、房贷、物业、水电燃气、维修 |
| 🎮 娱乐 | 电影、游戏、旅游、运动健身、KTV/酒吧 |
| 💊 医疗 | 看病、药品、体检、牙科 |
| 📚 教育 | 课程、书籍、考试报名、文具 |
| 🎁 人情 | 送礼、红包、婚礼/生日、孝敬父母 |
| 📱 通讯 | 话费、宽带、快递 |
| 📌 其他 | 无法分类 |

用户可自由增加、修改、删除分类。

---

## 📅 未来计划

- [ ] 收入记录功能
- [ ] 月度预算设置与提醒
- [ ] 多账户支持（现金、银行卡、微信、支付宝）
- [ ] 深色模式
- [ ] 应用图标设计

---

## 📄 开源协议

MIT License

---

<p align="center">
  <sub>Made with ❤️ by 黑马记账</sub>
</p>
