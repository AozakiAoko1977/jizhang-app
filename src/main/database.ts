import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'

// sql.js types
let db: any = null

// Default categories (2-level)
const DEFAULT_CATEGORIES: { l1: string; l2: string[] }[] = [
  { l1: '🍜 餐饮', l2: ['三餐', '零食', '饮品', '外卖', '聚餐'] },
  { l1: '🚗 交通', l2: ['公交地铁', '打车', '加油', '停车', '高铁/机票'] },
  { l1: '🛒 购物', l2: ['日用品', '服饰', '数码', '家居', '美妆'] },
  { l1: '🏠 住房', l2: ['房租', '房贷', '物业', '水电燃气', '维修'] },
  { l1: '🎮 娱乐', l2: ['电影', '游戏', '旅游', '运动健身', 'KTV/酒吧'] },
  { l1: '💊 医疗', l2: ['看病', '药品', '体检', '牙科'] },
  { l1: '📚 教育', l2: ['课程', '书籍', '考试报名', '文具'] },
  { l1: '🎁 人情', l2: ['送礼', '红包', '婚礼/生日', '孝敬父母'] },
  { l1: '📱 通讯', l2: ['话费', '宽带', '快递'] },
  { l1: '📌 其他', l2: ['无法分类'] }
]

function getDbPath(): string {
  const userDataPath = app.getPath('userData')
  return join(userDataPath, 'heima-jizhang.db')
}

function saveDb(): void {
  if (!db) return
  const data = db.export()
  const buffer = Buffer.from(data)
  writeFileSync(getDbPath(), buffer)
}

// Convert sql.js row array to object
function rowsToObjects(result: any): any[] {
  if (!result.length || !result[0].values.length) return []
  const columns = result[0].columns
  return result[0].values.map((row: any[]) => {
    const obj: any = {}
    columns.forEach((col: string, i: number) => {
      obj[col] = row[i]
    })
    return obj
  })
}

export async function initDatabase(): Promise<void> {
  const initSqlJs = require('sql.js')
  const SQL = await initSqlJs()

  const dbPath = getDbPath()

  if (existsSync(dbPath)) {
    const fileBuffer = readFileSync(dbPath)
    db = new SQL.Database(fileBuffer)
  } else {
    db = new SQL.Database()
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_l1 TEXT NOT NULL,
      name_l2 TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      UNIQUE(name_l1, name_l2)
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL,
      category_l1 TEXT NOT NULL,
      category_l2 TEXT NOT NULL,
      date TEXT NOT NULL,
      note TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `)

  // Seed default categories if empty
  const result = db.exec('SELECT COUNT(*) as cnt FROM categories')
  const count = result[0]?.values?.[0]?.[0] ?? 0
  if (count === 0) {
    const stmt = db.prepare(
      'INSERT INTO categories (name_l1, name_l2, sort_order) VALUES (?, ?, ?)'
    )
    DEFAULT_CATEGORIES.forEach((cat, l1Idx) => {
      cat.l2.forEach((l2Name, l2Idx) => {
        stmt.run([cat.l1, l2Name, l1Idx * 100 + l2Idx])
      })
    })
    stmt.free()
    saveDb()
  }
}

// --- Category queries ---

export interface Category {
  id: number
  name_l1: string
  name_l2: string
  sort_order: number
}

export function getCategories(): Category[] {
  if (!db) return []
  const result = db.exec('SELECT * FROM categories ORDER BY sort_order')
  return rowsToObjects(result) as Category[]
}

export function getCategoriesGrouped(): { l1: string; l2: string[] }[] {
  const cats = getCategories()
  const map = new Map<string, string[]>()
  cats.forEach((c) => {
    if (!map.has(c.name_l1)) map.set(c.name_l1, [])
    map.get(c.name_l1)!.push(c.name_l2)
  })
  return Array.from(map.entries()).map(([l1, l2]) => ({ l1, l2 }))
}

export function getL1Categories(): string[] {
  if (!db) return []
  const result = db.exec('SELECT DISTINCT name_l1 FROM categories ORDER BY sort_order')
  if (!result.length || !result[0].values.length) return []
  return result[0].values.map((row: any[]) => row[0] as string)
}

export function addCategory(
  name_l1: string,
  name_l2: string
): Category {
  if (!db) throw new Error('Database not initialized')

  // Check duplicate using prepared statement
  const checkStmt = db.prepare(
    'SELECT id FROM categories WHERE name_l1=? AND name_l2=?'
  )
  checkStmt.bind([name_l1, name_l2])
  const exists = checkStmt.step()
  checkStmt.free()
  if (exists) {
    throw new Error('该分类已存在')
  }

  // Get max sort order for this L1
  const orderStmt = db.prepare(
    'SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM categories WHERE name_l1=?'
  )
  orderStmt.bind([name_l1])
  orderStmt.step()
  const { next_order } = orderStmt.getAsObject()
  orderStmt.free()
  const nextOrder = (next_order as number) ?? 1

  const stmt = db.prepare(
    'INSERT INTO categories (name_l1, name_l2, sort_order) VALUES (?, ?, ?)'
  )
  stmt.run([name_l1, name_l2, nextOrder])
  stmt.free()

  const result = db.exec('SELECT last_insert_rowid() as id')
  const id = result[0].values[0][0] as number

  saveDb()
  return { id, name_l1, name_l2, sort_order: nextOrder }
}

export function updateCategory(
  id: number,
  oldL1: string,
  oldL2: string,
  newL1: string,
  newL2: string
): void {
  if (!db) throw new Error('Database not initialized')

  // Update the category record
  const stmt = db.prepare(
    'UPDATE categories SET name_l1=?, name_l2=? WHERE id=?'
  )
  stmt.run([newL1, newL2, id])
  stmt.free()

  // Update all bills using the old category names
  const stmt2 = db.prepare(
    'UPDATE bills SET category_l1=?, category_l2=? WHERE category_l1=? AND category_l2=?'
  )
  stmt2.run([newL1, newL2, oldL1, oldL2])
  stmt2.free()

  saveDb()
}

export function deleteCategory(
  id: number,
  name_l1: string,
  name_l2: string
): { success: boolean; reason?: string } {
  if (!db) throw new Error('Database not initialized')

  // Check if any bills use this category
  const checkStmt = db.prepare(
    'SELECT COUNT(*) as cnt FROM bills WHERE category_l1=? AND category_l2=?'
  )
  checkStmt.bind([name_l1, name_l2])
  let billCount = 0
  if (checkStmt.step()) {
    const obj = checkStmt.getAsObject()
    billCount = obj.cnt as number
  }
  checkStmt.free()

  if (billCount > 0) {
    return {
      success: false,
      reason: `该分类下有 ${billCount} 条账单，无法删除。请先删除相关账单或将其移至其他分类。`
    }
  }

  // Check if this is the last L2 under this L1 - allow deletion
  db.prepare('DELETE FROM categories WHERE id=?').run([id])
  saveDb()
  return { success: true }
}

// --- Bill CRUD ---

export interface Bill {
  id?: number
  amount: number
  category_l1: string
  category_l2: string
  date: string
  note?: string
  created_at?: string
  updated_at?: string
}

export function getBills(): Bill[] {
  if (!db) return []
  const result = db.exec('SELECT * FROM bills ORDER BY date DESC, id DESC')
  return rowsToObjects(result) as Bill[]
}

export function getBillsByDateRange(startDate: string, endDate: string): Bill[] {
  if (!db) return []
  const stmt = db.prepare(
    'SELECT * FROM bills WHERE date >= ? AND date <= ? ORDER BY date DESC, id DESC'
  )
  stmt.bind([startDate, endDate])
  const rows: Bill[] = []
  while (stmt.step()) {
    rows.push(stmt.getAsObject())
  }
  stmt.free()
  return rows
}

export function getTodayBills(): Bill[] {
  if (!db) return []
  const today = new Date().toISOString().slice(0, 10)
  return getBillsByDateRange(today, today)
}

export function getMonthBills(year: number, month: number): Bill[] {
  if (!db) return []
  const m = String(month).padStart(2, '0')
  const start = `${year}-${m}-01`
  const end = `${year}-${m}-31`
  return getBillsByDateRange(start, end)
}

export function getTodayTotal(): number {
  const bills = getTodayBills()
  return bills.reduce((sum, b) => sum + b.amount, 0)
}

export function getMonthTotal(year: number, month: number): number {
  const bills = getMonthBills(year, month)
  return bills.reduce((sum, b) => sum + b.amount, 0)
}

export function addBill(bill: Bill): Bill {
  if (!db) throw new Error('Database not initialized')
  const stmt = db.prepare(
    'INSERT INTO bills (amount, category_l1, category_l2, date, note) VALUES (?, ?, ?, ?, ?)'
  )
  stmt.run([bill.amount, bill.category_l1, bill.category_l2, bill.date, bill.note || ''])
  stmt.free()

  const result = db.exec('SELECT last_insert_rowid() as id')
  const id = result[0].values[0][0] as number

  saveDb()
  return { ...bill, id }
}

export function updateBill(bill: Bill): void {
  if (!db) throw new Error('Database not initialized')
  const stmt = db.prepare(
    `UPDATE bills SET amount=?, category_l1=?, category_l2=?, date=?, note=?,
     updated_at=datetime('now','localtime') WHERE id=?`
  )
  stmt.run([bill.amount, bill.category_l1, bill.category_l2, bill.date, bill.note || '', bill.id])
  stmt.free()
  saveDb()
}

export function deleteBill(id: number): void {
  if (!db) throw new Error('Database not initialized')
  db.prepare('DELETE FROM bills WHERE id=?').run([id])
  saveDb()
}

// --- Statistics ---

export interface CategoryStat {
  name: string
  amount: number
  percentage: number
}

export interface MonthStats {
  total: number
  avgDaily: number
  recordDays: number
  billCount: number
  byCategory: CategoryStat[]
}

export function getMonthStats(year: number, month: number): MonthStats {
  const bills = getMonthBills(year, month)
  const total = bills.reduce((sum, b) => sum + b.amount, 0)

  // Unique record days
  const days = new Set(bills.map((b) => b.date))
  const recordDays = days.size

  // Days in month
  const daysInMonth = new Date(year, month, 0).getDate()
  const avgDaily = recordDays > 0 ? total / daysInMonth : 0

  // By L1 category
  const categoryMap = new Map<string, number>()
  bills.forEach((b) => {
    const current = categoryMap.get(b.category_l1) || 0
    categoryMap.set(b.category_l1, current + b.amount)
  })

  const byCategory: CategoryStat[] = Array.from(categoryMap.entries())
    .map(([name, amount]) => ({
      name,
      amount,
      percentage: total > 0 ? Math.round((amount / total) * 10000) / 100 : 0
    }))
    .sort((a, b) => b.amount - a.amount)

  return {
    total,
    avgDaily: Math.round(avgDaily * 100) / 100,
    recordDays,
    billCount: bills.length,
    byCategory
  }
}

export function getStatsByDateRange(
  startDate: string,
  endDate: string
): MonthStats {
  if (!db) return { total: 0, avgDaily: 0, recordDays: 0, billCount: 0, byCategory: [] }
  const bills = getBillsByDateRange(startDate, endDate)
  const total = bills.reduce((sum, b) => sum + b.amount, 0)
  const days = new Set(bills.map((b) => b.date))
  const recordDays = days.size

  const start = new Date(startDate)
  const end = new Date(endDate)
  const dateSpan = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  const avgDaily = recordDays > 0 ? total / dateSpan : 0

  const categoryMap = new Map<string, number>()
  bills.forEach((b) => {
    const current = categoryMap.get(b.category_l1) || 0
    categoryMap.set(b.category_l1, current + b.amount)
  })

  const byCategory: CategoryStat[] = Array.from(categoryMap.entries())
    .map(([name, amount]) => ({
      name,
      amount,
      percentage: total > 0 ? Math.round((amount / total) * 10000) / 100 : 0
    }))
    .sort((a, b) => b.amount - a.amount)

  return {
    total,
    avgDaily: Math.round(avgDaily * 100) / 100,
    recordDays,
    billCount: bills.length,
    byCategory
  }
}

export function getMonthlyTrend(year: number): {
  month: string
  total: number
  byCategory: { name: string; amount: number }[]
}[] {
  const result: { month: string; total: number; byCategory: { name: string; amount: number }[] }[] =
    []
  for (let m = 1; m <= 12; m++) {
    const monthStr = String(m).padStart(2, '0')
    const bills = getMonthBills(year, m)
    const total = bills.reduce((sum, b) => sum + b.amount, 0)
    const catMap = new Map<string, number>()
    bills.forEach((b) => {
      catMap.set(b.category_l1, (catMap.get(b.category_l1) || 0) + b.amount)
    })
    result.push({
      month: `${year}-${monthStr}`,
      total,
      byCategory: Array.from(catMap.entries()).map(([name, amount]) => ({ name, amount }))
    })
  }
  return result
}

// --- Data Management ---

export function exportCSV(filePath: string): void {
  if (!db) throw new Error('Database not initialized')
  const bills = getBills()
  // BOM for Excel Chinese compatibility
  const BOM = '﻿'
  const headers = ['日期', '一级分类', '二级分类', '金额', '备注']
  const rows = bills.map((b) =>
    [b.date, b.category_l1, b.category_l2, b.amount.toFixed(2), b.note || '']
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  )
  const csv = BOM + headers.join(',') + '\n' + rows.join('\n')
  writeFileSync(filePath, csv, 'utf-8')
}

export function exportBackup(filePath: string): void {
  const dbPath = getDbPath()
  if (!existsSync(dbPath)) throw new Error('数据库文件不存在')
  readFileSync(dbPath) // ensure readable
  writeFileSync(filePath, readFileSync(dbPath))
}

export function restoreBackup(filePath: string): void {
  if (!existsSync(filePath)) throw new Error('备份文件不存在')
  const dbPath = getDbPath()
  // Close current db
  if (db) {
    db.close()
    db = null
  }
  // Copy backup to db location
  writeFileSync(dbPath, readFileSync(filePath))
  // Re-open
  const initSqlJs = require('sql.js')
  initSqlJs().then((SQL: any) => {
    db = new SQL.Database(readFileSync(dbPath))
  })
}

export async function restoreBackupSync(filePath: string): Promise<void> {
  if (!existsSync(filePath)) throw new Error('备份文件不存在')
  const dbPath = getDbPath()
  if (db) {
    db.close()
    db = null
  }
  writeFileSync(dbPath, readFileSync(filePath))
  const initSqlJs = require('sql.js')
  const SQL = await initSqlJs()
  db = new SQL.Database(readFileSync(dbPath))
}

export function clearAllData(): void {
  if (!db) throw new Error('Database not initialized')
  db.run('DELETE FROM bills')
  saveDb()
}

export function getDatabasePath(): string {
  return getDbPath()
}
