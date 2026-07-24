/**
 * index.ts — Electron 主进程入口文件
 * =============================================
 * 这个文件是 Electron 应用的"大管家"，负责：
 *
 *   ① 创建应用窗口（设置大小、图标等）
 *   ② 注册 IPC 通信通道（前端 ↔ 后端数据交互的"电话线"）
 *   ③ 管理应用生命周期（启动、激活、退出）
 *
 * 简单理解：这个文件决定了 App 的"外壳"——窗口长什么样、
 * 什么时候启动、什么时候关闭、前端怎么跟数据库通信。
 *
 * 安全提醒：
 *   第 40 行 sandbox: false 应改为 true（Electron 28+ 支持）
 *   第 65 行 shell.openExternal 需校验 URL 协议
 */

import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron'
import { join } from 'path'
import {
  initDatabase,
  getBills,
  getTodayTotal,
  getMonthTotal,
  getMonthBills,
  getCategories,
  getCategoriesGrouped,
  getL1Categories,
  addBill,
  updateBill,
  deleteBill,
  addCategory,
  updateCategory,
  deleteCategory,
  getMonthStats,
  getStatsByDateRange,
  getMonthlyTrend,
  exportCSV,
  exportBackup,
  restoreBackupSync,
  clearAllData,
  getDatabasePath
} from './database'

// ============================================================
// 环境判断
// ============================================================

/**
 * isDev — 判断当前是否在开发模式下运行
 *
 * app.isPackaged = false 表示是开发模式（用 npm run dev 启动）
 * app.isPackaged = true  表示是生产模式（打包后的 exe/dmg）
 *
 * 开发模式下会有额外功能：F12 打开开发者工具、Ctrl+R 禁止刷新等
 */
const isDev = !app.isPackaged

// ============================================================
// 窗口管理
// ============================================================

/**
 * 创建应用主窗口
 *
 * 窗口配置说明：
 *   width/height — 默认窗口尺寸（宽 1100、高 750 像素）
 *   minWidth/minHeight — 最小尺寸限制，防止用户缩得太小导致界面变形
 *   show: false — 先不显示，等页面加载完毕再显示（避免白屏闪烁）
 *   preload — 预加载脚本路径，负责安全地桥接前端和 Node.js
 *   sandbox — 应开启沙箱模式以增强安全性（TODO: 改为 true）
 */
function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 900,
    minHeight: 600,
    show: false,              // 等 ready-to-show 事件触发后再显示
    title: '黑马记账',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false          // ⚠️ TODO: 改为 true（安全加固），preload 脚本兼容沙箱模式
    }
  })

  // ===== 键盘快捷键处理 =====

  // 开发模式下：F12 切换开发者工具（用于调试）
  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.type === 'keyDown') {
      // F12 → 打开/关闭 DevTools（仅在开发模式有效）
      if (isDev && input.code === 'F12') {
        if (mainWindow.webContents.isDevToolsOpened()) {
          mainWindow.webContents.closeDevTools()
        } else {
          mainWindow.webContents.openDevTools({ mode: 'undocked' })
        }
      }
      // Ctrl+R / Cmd+R → 在开发模式下禁止刷新页面（Vite HMR 会自动刷新，手动刷新会报错）
      if (isDev && input.code === 'KeyR' && (input.control || input.meta)) {
        _event.preventDefault()
      }
    }
  })

  // ===== 窗口生命周期 =====

  // 页面渲染完成后才显示窗口——避免空白窗口一闪而过
  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // 拦截新窗口打开请求，改为在系统默认浏览器中打开
  // ⚠️ TODO: 应校验 URL 协议，只允许 http: 和 https:
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }  // 不在 Electron 内打开新窗口，统一用外部浏览器
  })

  // ===== 加载页面 =====

  // 开发模式：加载 Vite 开发服务器地址（支持热更新）
  // 生产模式：加载打包后的静态 HTML 文件
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ============================================================
// 应用启动
// ============================================================

/**
 * app.whenReady() — Electron 应用初始化完成后的回调
 *
 * 这里是整个应用的"启动按钮"——Electron 框架就绪后，
 * 按顺序执行：设置应用ID → 初始化数据库 → 注册通信通道 → 创建窗口
 *
 * IPC 通信说明：
 *   Electron 有"主进程"（Node.js 后端）和"渲染进程"（React 前端）两个世界。
 *   它们不能直接互相调用，需要通过 IPC（进程间通信）来传递消息。
 *
 *   规则是：主进程通过 ipcMain.handle 注册"处理程序"（像设置电话分机号），
 *   前端的 preload 脚本通过 ipcRenderer.invoke 来"打电话"调用这些处理程序。
 *
 *   命名规范：功能:动作（如 bills:add、categories:getAll）
 *   这样一眼就能看出是哪块功能的哪个操作。
 */
app.whenReady().then(async () => {
  // Windows 系统：设置应用 ID（用于通知栏、任务栏分组等）
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.heima.jizhang')
  }

  // 第一步：初始化数据库（创建表、写入预设分类等）
  await initDatabase()

  // ============================================================
  // 第二步：注册 IPC 通信通道
  // 这些 handle 把前端的请求转发给 database.ts 中的对应函数
  // ============================================================

  // --- 账单 CRUD ---
  ipcMain.handle('bills:getAll', () => getBills())
  ipcMain.handle('bills:add', (_, bill) => addBill(bill))
  ipcMain.handle('bills:update', (_, bill) => updateBill(bill))
  ipcMain.handle('bills:delete', (_, id) => deleteBill(id))

  // --- 统计数据 ---
  ipcMain.handle('stats:todayTotal', () => getTodayTotal())
  ipcMain.handle('stats:monthTotal', (_, year, month) => getMonthTotal(year, month))
  ipcMain.handle('stats:monthBills', (_, year, month) => getMonthBills(year, month))
  ipcMain.handle('stats:monthStats', (_, year, month) => getMonthStats(year, month))
  ipcMain.handle('stats:rangeStats', (_, start, end) => getStatsByDateRange(start, end))
  ipcMain.handle('stats:monthlyTrend', (_, year) => getMonthlyTrend(year))

  // --- 分类管理 ---
  ipcMain.handle('categories:getAll', () => getCategories())
  ipcMain.handle('categories:getGrouped', () => getCategoriesGrouped())
  ipcMain.handle('categories:getL1', () => getL1Categories())
  ipcMain.handle('categories:add', (_, cat) => addCategory(cat.name_l1, cat.name_l2))
  ipcMain.handle('categories:update', (_, data) =>
    updateCategory(data.id, data.oldL1, data.oldL2, data.newL1, data.newL2)
  )
  ipcMain.handle('categories:delete', (_, data) =>
    deleteCategory(data.id, data.name_l1, data.name_l2)
  )

  // --- 数据管理 ---
  // 导出 CSV 文件：弹出"另存为"对话框，让用户选择保存位置
  ipcMain.handle('data:exportCSV', async () => {
    const result = await dialog.showSaveDialog({
      title: '导出账单为 CSV',
      defaultPath: `黑马记账_账单导出_${new Date().toISOString().slice(0, 10)}.csv`,
      filters: [{ name: 'CSV 文件', extensions: ['csv'] }]
    })
    if (!result.canceled && result.filePath) {
      exportCSV(result.filePath)
      return { success: true, path: result.filePath }
    }
    return { success: false }
  })

  // 数据库备份：弹出"另存为"对话框
  ipcMain.handle('data:backup', async () => {
    const result = await dialog.showSaveDialog({
      title: '备份数据库',
      defaultPath: `黑马记账_备份_${new Date().toISOString().slice(0, 10)}.db`,
      filters: [{ name: '数据库文件', extensions: ['db'] }]
    })
    if (!result.canceled && result.filePath) {
      exportBackup(result.filePath)
      return { success: true, path: result.filePath }
    }
    return { success: false }
  })

  // 恢复备份：弹出"打开文件"对话框
  ipcMain.handle('data:restore', async () => {
    const result = await dialog.showOpenDialog({
      title: '从备份恢复数据',
      filters: [{ name: '数据库文件', extensions: ['db'] }],
      properties: ['openFile']
    })
    if (!result.canceled && result.filePaths.length > 0) {
      await restoreBackupSync(result.filePaths[0])
      return { success: true }
    }
    return { success: false }
  })

  // 清空全部数据（前端会先弹出二次确认）
  ipcMain.handle('data:clear', () => {
    clearAllData()
    return { success: true }
  })

  // 获取数据库文件路径（在设置页面显示）
  ipcMain.handle('data:getPath', () => getDatabasePath())

  // 第三步：创建窗口
  createWindow()

  // macOS 特殊处理：点击 Dock 图标时，如果所有窗口都关了，自动重新创建窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// ============================================================
// 应用退出
// ============================================================

/**
 * 所有窗口关闭时触发
 *   Windows/Linux：直接退出应用
 *   macOS：不退出（Mac 应用惯例是关窗不退出，用户需按 Cmd+Q 手动退出）
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
