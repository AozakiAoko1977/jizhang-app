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

const isDev = !app.isPackaged

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: '黑马记账',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // DevTools shortcut (F12) in dev mode
  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.type === 'keyDown') {
      if (isDev && input.code === 'F12') {
        if (mainWindow.webContents.isDevToolsOpened()) {
          mainWindow.webContents.closeDevTools()
        } else {
          mainWindow.webContents.openDevTools({ mode: 'undocked' })
        }
      }
      if (isDev && input.code === 'KeyR' && (input.control || input.meta)) {
        _event.preventDefault()
      }
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.heima.jizhang')
  }

  await initDatabase()

  // Bill IPC handlers
  ipcMain.handle('bills:getAll', () => getBills())
  ipcMain.handle('bills:add', (_, bill) => addBill(bill))
  ipcMain.handle('bills:update', (_, bill) => updateBill(bill))
  ipcMain.handle('bills:delete', (_, id) => deleteBill(id))

  // Stats IPC handlers
  ipcMain.handle('stats:todayTotal', () => getTodayTotal())
  ipcMain.handle('stats:monthTotal', (_, year, month) => getMonthTotal(year, month))
  ipcMain.handle('stats:monthBills', (_, year, month) => getMonthBills(year, month))
  ipcMain.handle('stats:monthStats', (_, year, month) => getMonthStats(year, month))
  ipcMain.handle('stats:rangeStats', (_, start, end) => getStatsByDateRange(start, end))
  ipcMain.handle('stats:monthlyTrend', (_, year) => getMonthlyTrend(year))

  // Category IPC handlers
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

  // Data Management IPC handlers
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

  ipcMain.handle('data:clear', () => {
    clearAllData()
    return { success: true }
  })

  ipcMain.handle('data:getPath', () => getDatabasePath())

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
