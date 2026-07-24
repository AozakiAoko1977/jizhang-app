/**
 * database.ts — 数据库管理模块
 * =============================================
 * 这个文件是记账 App 的"数据大脑"，负责所有数据的存储和查询。
 *
 * 工作原理：使用 sql.js（一个纯 JavaScript 的 SQLite 数据库），
 * 不需要用户安装任何额外的数据库软件，数据直接保存在用户电脑上。
 *
 * 主要功能分为四大块：
 *   ① 初始化（建表、预设分类）
 *   ② 分类管理（增删改查）
 *   ③ 账单管理（增删改查 + 统计）
 *   ④ 数据管理（导出CSV、备份、恢复、清空）
 *
 * 安全说明：所有 SQL 查询都使用参数化查询（? 占位符），
 * 可以有效防止 SQL 注入攻击——即使用户输入恶意内容也不会影响数据库。
 */

import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'

// ============================================================
// 全局状态
// ============================================================

// sql.js 的数据库实例，相当于"数据库连接"。
// 初始为 null，在 initDatabase() 被调用后才会赋值。
// 之所以放在全局，是因为整个应用只需要一个数据库连接，
// 所有函数共用这个连接来读写数据。
let db: any = null

// ============================================================
// 预设分类数据
// ============================================================

/**
 * 默认的 10 个大类 + 对应的二级小类
 * 首次启动 App 时，如果数据库里还没有分类数据，
 * 会自动把这些预设分类写入数据库，用户开箱即用。
 * 之后用户可以在"分类管理"页面自由增删改。
 */
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

// ============================================================
// 内部辅助函数（不导出，仅供本文件内部使用）
// ============================================================

/**
 * 获取数据库文件的存储路径
 * 数据库文件存放在 Electron 的"用户数据目录"下，
 * 例如 Windows 上是：C:\Users\你的用户名\AppData\Roaming\黑马记账\heima-jizhang.db
 * 每个用户的数据库是独立的，不会互相影响。
 */
function getDbPath(): string {
  const userDataPath = app.getPath('userData')
  return join(userDataPath, 'heima-jizhang.db')
}

/**
 * 把内存中的数据库变更保存到硬盘文件
 * sql.js 在内存中操作数据库（速度快），
 * 每次增删改之后都要调用这个函数来"落盘"，
 * 否则 App 关闭后数据就丢失了（类似 Word 没保存）。
 */
function saveDb(): void {
  if (!db) return
  const data = db.export()
  const buffer = Buffer.from(data)
  writeFileSync(getDbPath(), buffer)
}

/**
 * 把 SQL 查询结果从"数组格式"转成"对象格式"
 *
 * sql.js 的 db.exec() 返回的是二维数组，使用起来很不方便。
 * 比如查询结果 [[1, '餐饮', '三餐'], [2, '交通', '打车']]
 * 这个函数把它转成 [{id: 1, name_l1: '餐饮', name_l2: '三餐'}, ...]
 *
 * 这样后续代码就能用 row.id、row.name_l1 来访问数据，更直观。
 */
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

// ============================================================
// ① 数据库初始化
// ============================================================

/**
 * 初始化数据库——App 启动时只调用一次
 *
 * 执行步骤：
 *   1. 加载 sql.js 库
 *   2. 如果数据库文件已存在 → 打开（保留用户已有的数据）
 *      如果不存在 → 创建新数据库（首次启动）
 *   3. 创建 bills（账单）和 categories（分类）两张表（如果还不存在的话）
 *   4. 如果是首次启动，把预设的 10 个大类写入分类表
 *
 * 注意：CREATE TABLE IF NOT EXISTS 是安全的，不会覆盖已有的表和数据。
 */
export async function initDatabase(): Promise<void> {
  const initSqlJs = require('sql.js')
  const SQL = await initSqlJs()

  const dbPath = getDbPath()

  // 检查数据库文件是否存在——存在就打开，不存在就创建新的
  if (existsSync(dbPath)) {
    const fileBuffer = readFileSync(dbPath)
    db = new SQL.Database(fileBuffer)
  } else {
    db = new SQL.Database()
  }

  // ===== 建表 =====

  // 分类表：存储用户的所有收支分类（一级大类 + 二级小类）
  // UNIQUE(name_l1, name_l2) 确保同一个大类下不会出现重复的小类
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

  // 账单表：存储每一笔记账记录
  // amount 是 REAL 类型（支持小数），category_l1/l2 存的是分类名称（冗余存储，方便查询）
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

  // 检查分类表是否为空（首次启动），空的话写入预设分类
  const result = db.exec('SELECT COUNT(*) as cnt FROM categories')
  const count = result[0]?.values?.[0]?.[0] ?? 0
  if (count === 0) {
    const stmt = db.prepare(
      'INSERT INTO categories (name_l1, name_l2, sort_order) VALUES (?, ?, ?)'
    )
    // 遍历预设的 10 个大类，逐个写入（sort_order 用于控制显示顺序）
    DEFAULT_CATEGORIES.forEach((cat, l1Idx) => {
      cat.l2.forEach((l2Name, l2Idx) => {
        stmt.run([cat.l1, l2Name, l1Idx * 100 + l2Idx])
      })
    })
    stmt.free()
    saveDb()
  }
}

// ============================================================
// ② 分类管理（增删改查）
// ============================================================

/**
 * 分类数据结构
 * id        — 数据库自增编号
 * name_l1   — 一级大类名称（如"🍜 餐饮"）
 * name_l2   — 二级小类名称（如"三餐"）
 * sort_order — 排序权重（数字越小越靠前）
 */
export interface Category {
  id: number
  name_l1: string
  name_l2: string
  sort_order: number
}

/**
 * 获取全部分类列表（按排序顺序返回）
 * 用于："分类管理"页面展示所有分类
 */
export function getCategories(): Category[] {
  if (!db) return []
  const result = db.exec('SELECT * FROM categories ORDER BY sort_order')
  return rowsToObjects(result) as Category[]
}

/**
 * 获取分类的分组数据——把所有小类按大类归类
 *
 * 返回示例：
 *   [{ l1: '🍜 餐饮', l2: ['三餐', '零食', '饮品'] },
 *    { l1: '🚗 交通', l2: ['公交地铁', '打车'] }]
 *
 * 用于：账单表单中的二级联动下拉框（先选大类，再选对应的小类）
 */
export function getCategoriesGrouped(): { l1: string; l2: string[] }[] {
  const cats = getCategories()
  const map = new Map<string, string[]>()
  cats.forEach((c) => {
    if (!map.has(c.name_l1)) map.set(c.name_l1, [])
    map.get(c.name_l1)!.push(c.name_l2)
  })
  return Array.from(map.entries()).map(([l1, l2]) => ({ l1, l2 }))
}

/**
 * 获取所有一级大类名称列表（去重）
 * 用于：统计页面的分类筛选、分类管理的大类列表
 */
export function getL1Categories(): string[] {
  if (!db) return []
  const result = db.exec('SELECT DISTINCT name_l1 FROM categories ORDER BY sort_order')
  if (!result.length || !result[0].values.length) return []
  return result[0].values.map((row: any[]) => row[0] as string)
}

/**
 * 新增一个分类
 *
 * @param name_l1 - 属于哪个一级大类
 * @param name_l2 - 二级小类名称
 * @returns 新创建的分类对象（包含自动生成的 id）
 * @throws 如果该分类已存在，抛出错误"该分类已存在"
 *
 * 注意：使用参数化查询（?）防止 SQL 注入，
 * 同时先用 SELECT 检查是否重复，避免数据库 UNIQUE 约束报错。
 */
export function addCategory(
  name_l1: string,
  name_l2: string
): Category {
  if (!db) throw new Error('Database not initialized')

  // 第一步：检查是否已经存在同名的分类
  const checkStmt = db.prepare(
    'SELECT id FROM categories WHERE name_l1=? AND name_l2=?'
  )
  checkStmt.bind([name_l1, name_l2])
  const exists = checkStmt.step()
  checkStmt.free()
  if (exists) {
    throw new Error('该分类已存在')
  }

  // 第二步：计算这个大类下新增小类的排序序号
  // MAX(sort_order) + 1 = 排在当前最后一个小类的后面
  const orderStmt = db.prepare(
    'SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM categories WHERE name_l1=?'
  )
  orderStmt.bind([name_l1])
  orderStmt.step()
  const { next_order } = orderStmt.getAsObject()
  orderStmt.free()
  const nextOrder = (next_order as number) ?? 1

  // 第三步：插入新分类记录
  const stmt = db.prepare(
    'INSERT INTO categories (name_l1, name_l2, sort_order) VALUES (?, ?, ?)'
  )
  stmt.run([name_l1, name_l2, nextOrder])
  stmt.free()

  // 第四步：获取自动生成的 id 并返回完整对象
  const result = db.exec('SELECT last_insert_rowid() as id')
  const id = result[0].values[0][0] as number

  saveDb()
  return { id, name_l1, name_l2, sort_order: nextOrder }
}

/**
 * 修改分类名称
 *
 * @param id      - 要修改的分类 ID
 * @param oldL1   - 旧的一级大类名称（用于同步更新账单表）
 * @param oldL2   - 旧的二级小类名称（用于同步更新账单表）
 * @param newL1   - 新的一级大类名称
 * @param newL2   - 新的二级小类名称
 *
 * 重要：修改分类名称时，需要同时更新两个地方：
 *   ① 分类表（categories）——改名字
 *   ② 账单表（bills）——把引用旧分类名的账单改为新分类名
 * 这样用户在"分类管理"改了名字后，历史账单的分类也跟着更新。
 */
export function updateCategory(
  id: number,
  oldL1: string,
  oldL2: string,
  newL1: string,
  newL2: string
): void {
  if (!db) throw new Error('Database not initialized')

  // 更新分类表中的记录
  const stmt = db.prepare(
    'UPDATE categories SET name_l1=?, name_l2=? WHERE id=?'
  )
  stmt.run([newL1, newL2, id])
  stmt.free()

  // 同步更新账单表——把所有使用旧分类名的账单改为新分类名
  const stmt2 = db.prepare(
    'UPDATE bills SET category_l1=?, category_l2=? WHERE category_l1=? AND category_l2=?'
  )
  stmt2.run([newL1, newL2, oldL1, oldL2])
  stmt2.free()

  saveDb()
}

/**
 * 删除一个分类
 *
 * @returns { success: true } 删除成功
 *          { success: false, reason: "..." } 删除失败（该分类下还有账单）
 *
 * 安全规则：如果该分类下还有账单，不允许删除。
 * 这是为了防止用户误删分类后，历史账单变成"孤儿"。
 * 需要用户先把相关账单删除或转移到其他分类，再来删除分类。
 */
export function deleteCategory(
  id: number,
  name_l1: string,
  name_l2: string
): { success: boolean; reason?: string } {
  if (!db) throw new Error('Database not initialized')

  // 检查这个分类下还有多少条账单
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

  // 有账单 → 拒绝删除，并告知用户原因
  if (billCount > 0) {
    return {
      success: false,
      reason: `该分类下有 ${billCount} 条账单，无法删除。请先删除相关账单或将其移至其他分类。`
    }
  }

  // 无账单 → 安全删除
  db.prepare('DELETE FROM categories WHERE id=?').run([id])
  saveDb()
  return { success: true }
}

// ============================================================
// ③ 账单管理（增删改查 + 统计）
// ============================================================

/**
 * 账单数据结构
 * amount       — 金额（单位：元，人民币，支持两位小数）
 * category_l1  — 一级大类名称（如"🍜 餐饮"）
 * category_l2  — 二级小类名称（如"三餐"）
 * date         — 日期（格式：YYYY-MM-DD，如"2026-07-23"）
 * note         — 备注（可选，最长 100 字）
 * created_at / updated_at — 数据库自动记录的时间戳
 */
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

/**
 * 获取全部账单列表
 * 按日期倒序排列（最新的在最上面），同一天按 id 倒序
 * 用于：首页"最近账单"列表
 */
export function getBills(): Bill[] {
  if (!db) return []
  const result = db.exec('SELECT * FROM bills ORDER BY date DESC, id DESC')
  return rowsToObjects(result) as Bill[]
}

/**
 * 按日期范围筛选账单
 *
 * @param startDate - 开始日期，如 "2026-07-01"
 * @param endDate   - 结束日期，如 "2026-07-31"
 * @returns 该时间段内的所有账单，按日期倒序
 *
 * 分步读取数据的原因：
 * 结果集可能很大（比如一年的账单），一次性读入内存可能占很多内存。
 * 这里用 stmt.step() 逐步读取，适合数据量较大的场景。
 */
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

/**
 * 获取今天的账单
 * 用于：首页"今日支出"统计
 */
export function getTodayBills(): Bill[] {
  if (!db) return []
  const today = new Date().toISOString().slice(0, 10)
  return getBillsByDateRange(today, today)
}

/**
 * 获取某个月份的账单
 * 用于：月度统计页面
 *
 * 注意：这里用了一个"取巧"的方法——把月份的第一天到最后一天作为日期范围。
 * 因为账单日期格式统一为 YYYY-MM-DD，所以 >= 1号 且 <= 31号 就能覆盖整个月。
 * 即使月份只有 28/29/30 天，多余的天数不会匹配到数据，不影响结果。
 */
export function getMonthBills(year: number, month: number): Bill[] {
  if (!db) return []
  const m = String(month).padStart(2, '0')
  const start = `${year}-${m}-01`
  const end = `${year}-${m}-31`
  return getBillsByDateRange(start, end)
}

/**
 * 计算今日总支出
 * 获取今天所有账单，把金额全部加起来
 */
export function getTodayTotal(): number {
  const bills = getTodayBills()
  return bills.reduce((sum, b) => sum + b.amount, 0)
}

/**
 * 计算某月总支出
 * 获取该月所有账单，把金额全部加起来
 */
export function getMonthTotal(year: number, month: number): number {
  const bills = getMonthBills(year, month)
  return bills.reduce((sum, b) => sum + b.amount, 0)
}

/**
 * 新增一笔账单
 *
 * @param bill - 账单对象（不需要 id，数据库会自动生成）
 * @returns    - 带 id 的完整账单对象
 *
 * 安全说明：
 * 使用参数化查询（? 占位符），用户输入的金额、分类、备注等
 * 都会被安全地传入数据库，不会触发 SQL 注入。
 * 这就像银行柜台的防弹玻璃——用户的数据和 SQL 命令是隔开的。
 *
 * ⚠️ 当前缺失：没有对 amount 做后端校验（如禁止负数），
 * 校验逻辑只在前端（React 表单），攻击者可以绕过。
 * 建议后续加上：if (bill.amount <= 0) throw new Error(...)
 */
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

/**
 * 修改一笔账单
 * 同时更新 updated_at 字段为当前时间，方便追踪修改记录
 */
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

/**
 * 删除一笔账单（根据 id）
 * 注意：这个操作不可逆，前端会弹出确认提示框
 */
export function deleteBill(id: number): void {
  if (!db) throw new Error('Database not initialized')
  db.prepare('DELETE FROM bills WHERE id=?').run([id])
  saveDb()
}

// ============================================================
// ④ 统计与分析
// ============================================================

/**
 * 单个分类的统计结果
 * name       — 分类名称
 * amount     — 该分类的总支出金额
 * percentage — 占总支出百分比（如 35.5 表示 35.5%）
 */
export interface CategoryStat {
  name: string
  amount: number
  percentage: number
}

/**
 * 月度统计概览（用于统计页面展示）
 * total      — 该月总支出
 * avgDaily   — 日均支出（总支出 ÷ 当月总天数，不管当天有没有记账）
 * recordDays — 该月有多少天记了账
 * billCount  — 该月总账单条数
 * byCategory — 按大类拆分，每个大类花了多少钱、占比多少
 */
export interface MonthStats {
  total: number
  avgDaily: number
  recordDays: number
  billCount: number
  byCategory: CategoryStat[]
}

/**
 * 获取某个月的完整统计数据
 *
 * 计算逻辑：
 *   avgDaily（日均支出）= 总支出 ÷ 当月天数
 *   比如 7 月有 31 天，总共花了 3100 元 → 日均 100 元
 *   这反映的是"每天平均开销"的概览感觉，而不是"记账那几天平均花多少"
 *
 *   percentage（分类占比）=（该分类金额 ÷ 总金额）× 100
 *   百分比保留两位小数，比如 35.50 表示 35.5%
 *   所有分类的百分比加起来可能略低于或高于 100%（四舍五入导致），这是正常的
 */
export function getMonthStats(year: number, month: number): MonthStats {
  const bills = getMonthBills(year, month)
  const total = bills.reduce((sum, b) => sum + b.amount, 0)

  // 记账天数：用 Set 去重，因为同一天可能记了多笔
  const days = new Set(bills.map((b) => b.date))
  const recordDays = days.size

  // 当月总天数：new Date(year, month, 0) 会返回上个月的最后一天
  // 比如 new Date(2026, 7, 0) = 7月31日 → getDate() = 31
  const daysInMonth = new Date(year, month, 0).getDate()
  const avgDaily = recordDays > 0 ? total / daysInMonth : 0

  // 按一级大类汇总金额
  const categoryMap = new Map<string, number>()
  bills.forEach((b) => {
    const current = categoryMap.get(b.category_l1) || 0
    categoryMap.set(b.category_l1, current + b.amount)
  })

  // 计算每个大类的占比，并按金额从高到低排序
  const byCategory: CategoryStat[] = Array.from(categoryMap.entries())
    .map(([name, amount]) => ({
      name,
      amount,
      // percentage = (该分类金额 ÷ 总金额) × 100，保留两位小数
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

/**
 * 获取任意时间段内的统计数据（自定义日期范围）
 * 和 getMonthStats 逻辑一致，只是日期范围可以自由设定
 */
export function getStatsByDateRange(
  startDate: string,
  endDate: string
): MonthStats {
  if (!db) return { total: 0, avgDaily: 0, recordDays: 0, billCount: 0, byCategory: [] }
  const bills = getBillsByDateRange(startDate, endDate)
  const total = bills.reduce((sum, b) => sum + b.amount, 0)
  const days = new Set(bills.map((b) => b.date))
  const recordDays = days.size

  // 计算日期范围总跨度（起始日到结束日之间一共多少天）
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

/**
 * 获取全年的月度趋势数据
 *
 * @param year - 要查询的年份（如 2026）
 * @returns 12 个月的数组，每个元素包含：月份、总支出、按大类的分布
 *
 * 用于：统计页面的"月度趋势图"（柱状图/折线图）
 * 遍历 1 到 12 月，逐月调用 getMonthBills 计算每月的汇总数据。
 */
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

// ============================================================
// ⑤ 数据管理（导出、备份、恢复、清空）
// ============================================================

/**
 * 导出账单为 CSV 文件（可以在 Excel 中打开）
 *
 * CSV 是一种通用的表格格式，用逗号分隔每一列。
 *
 * @param filePath - 用户选择的保存路径（由系统"另存为"对话框提供）
 *
 * 特殊处理：
 *   ① BOM（文件头标记）：为了在 Excel 中正确显示中文，在文件开头写入 "﻿"
 *   ② 逗号转义：如果备注里包含引号，用两个引号代替一个引号
 *      比如 "买了一个5"手机" → "买了一个5""手机"""
 */
export function exportCSV(filePath: string): void {
  if (!db) throw new Error('Database not initialized')
  const bills = getBills()
  // 写入 BOM 头，确保 Excel 能正确识别中文编码
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

/**
 * 备份数据库——把数据库文件复制到用户选择的位置
 *
 * 备份文件是完整的 SQLite 数据库文件，
 * 以后可以通过"恢复数据"功能导入回来。
 *
 * @param filePath - 用户选择的备份文件保存路径
 */
export function exportBackup(filePath: string): void {
  const dbPath = getDbPath()
  if (!existsSync(dbPath)) throw new Error('数据库文件不存在')
  readFileSync(dbPath) // 先确认文件可读
  writeFileSync(filePath, readFileSync(dbPath))
}

/**
 * 从备份文件恢复数据（异步方式，已废弃）
 * 推荐使用下面的 restoreBackupSync 替代此函数
 *
 * ⚠️ 重要：恢复操作会覆盖当前所有数据！
 * 操作流程：关闭当前数据库 → 用备份文件替换 → 重新打开数据库
 */
export function restoreBackup(filePath: string): void {
  if (!existsSync(filePath)) throw new Error('备份文件不存在')
  const dbPath = getDbPath()
  // 关闭当前数据库连接（释放文件锁）
  if (db) {
    db.close()
    db = null
  }
  // 把备份文件拷贝到数据库位置（覆盖原来的）
  writeFileSync(dbPath, readFileSync(filePath))
  // 重新打开数据库
  const initSqlJs = require('sql.js')
  initSqlJs().then((SQL: any) => {
    db = new SQL.Database(readFileSync(dbPath))
  })
}

/**
 * 从备份文件恢复数据（同步方式，推荐使用）
 *
 * 和 restoreBackup 的区别：
 * 使用 async-await 模式，调用方可以等恢复完成后再继续操作，
 * 避免了"数据库还没打开就开始查数据"的竞态问题。
 *
 * ⚠️ 重要：恢复操作会覆盖当前所有数据！前端会弹出二次确认。
 */
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

/**
 * 清空所有账单数据
 *
 * ⚠️ 极度危险操作！只删除账单（bills 表），不删除分类（categories 表）。
 * 前端会弹出两次确认提示，防止用户误操作。
 * 此操作不可逆——删了就没有了，建议先备份。
 */
export function clearAllData(): void {
  if (!db) throw new Error('Database not initialized')
  db.run('DELETE FROM bills')
  saveDb()
}

/**
 * 获取数据库文件的完整路径
 * 用于：设置页面的"数据库位置"显示
 */
export function getDatabasePath(): string {
  return getDbPath()
}
