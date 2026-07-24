import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  DIR_VECTORS,
  OPPOSITE,
  KEY_MAP,
  randomFood,
  getSpeed,
  GRID_COUNT,
  TOTAL_CELLS
} from '@/pages/SnakeGame'

// ============================================================
// DIR_VECTORS — 方向向量
// ============================================================
describe('DIR_VECTORS', () => {
  it('UP 方向向上（y-1）', () => {
    expect(DIR_VECTORS.UP).toEqual({ x: 0, y: -1 })
  })
  it('DOWN 方向向下（y+1）', () => {
    expect(DIR_VECTORS.DOWN).toEqual({ x: 0, y: 1 })
  })
  it('LEFT 方向向左（x-1）', () => {
    expect(DIR_VECTORS.LEFT).toEqual({ x: -1, y: 0 })
  })
  it('RIGHT 方向向右（x+1）', () => {
    expect(DIR_VECTORS.RIGHT).toEqual({ x: 1, y: 0 })
  })
})

// ============================================================
// OPPOSITE — 反向映射
// ============================================================
describe('OPPOSITE', () => {
  it('UP 的反向是 DOWN', () => {
    expect(OPPOSITE.UP).toBe('DOWN')
  })
  it('DOWN 的反向是 UP', () => {
    expect(OPPOSITE.DOWN).toBe('UP')
  })
  it('LEFT 的反向是 RIGHT', () => {
    expect(OPPOSITE.LEFT).toBe('RIGHT')
  })
  it('RIGHT 的反向是 LEFT', () => {
    expect(OPPOSITE.RIGHT).toBe('LEFT')
  })
  it('所有方向都有对应的反向', () => {
    const dirs: Array<'UP' | 'DOWN' | 'LEFT' | 'RIGHT'> = ['UP', 'DOWN', 'LEFT', 'RIGHT']
    dirs.forEach((d) => {
      expect(OPPOSITE[d]).toBeDefined()
      expect(OPPOSITE[OPPOSITE[d]]).toBe(d) // 反向的反向 = 自己
    })
  })
})

// ============================================================
// KEY_MAP — 按键映射
// ============================================================
describe('KEY_MAP', () => {
  it('方向键映射正确', () => {
    expect(KEY_MAP.ArrowUp).toBe('UP')
    expect(KEY_MAP.ArrowDown).toBe('DOWN')
    expect(KEY_MAP.ArrowLeft).toBe('LEFT')
    expect(KEY_MAP.ArrowRight).toBe('RIGHT')
  })
  it('WASD 映射正确', () => {
    expect(KEY_MAP.w).toBe('UP')
    expect(KEY_MAP.W).toBe('UP')
    expect(KEY_MAP.s).toBe('DOWN')
    expect(KEY_MAP.S).toBe('DOWN')
    expect(KEY_MAP.a).toBe('LEFT')
    expect(KEY_MAP.A).toBe('LEFT')
    expect(KEY_MAP.d).toBe('RIGHT')
    expect(KEY_MAP.D).toBe('RIGHT')
  })
  it('不存在的按键返回 undefined', () => {
    expect(KEY_MAP.x).toBeUndefined()
    expect(KEY_MAP['Enter']).toBeUndefined()
  })
})

// ============================================================
// randomFood — 随机食物生成
// ============================================================
describe('randomFood', () => {
  it('返回的位置在网格范围内', () => {
    const snake = [{ x: 5, y: 5 }]
    for (let i = 0; i < 50; i++) {
      const food = randomFood(snake)
      expect(food.x).toBeGreaterThanOrEqual(0)
      expect(food.x).toBeLessThan(GRID_COUNT)
      expect(food.y).toBeGreaterThanOrEqual(0)
      expect(food.y).toBeLessThan(GRID_COUNT)
    }
  })

  it('返回的位置不与蛇身重叠', () => {
    const snake = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 }
    ]
    for (let i = 0; i < 20; i++) {
      const food = randomFood(snake)
      const isOnSnake = snake.some((s) => s.x === food.x && s.y === food.y)
      expect(isOnSnake).toBe(false)
    }
  })

  it('当网格只有一个空位时能找到它', () => {
    // 构造一个占满 399 个格子的蛇，只剩位置 (0, 0) 空着
    const snake: Array<{ x: number; y: number }> = []
    for (let y = 0; y < GRID_COUNT; y++) {
      for (let x = 0; x < GRID_COUNT; x++) {
        if (x === 0 && y === 0) continue // 留空
        snake.push({ x, y })
      }
    }
    const food = randomFood(snake)
    expect(food).toEqual({ x: 0, y: 0 })
  })

  it('当网格完全被蛇占满时返回 (-1, -1)', () => {
    const snake: Array<{ x: number; y: number }> = []
    for (let y = 0; y < GRID_COUNT; y++) {
      for (let x = 0; x < GRID_COUNT; x++) {
        snake.push({ x, y })
      }
    }
    expect(snake.length).toBe(TOTAL_CELLS) // 确认 400 格
    const food = randomFood(snake)
    expect(food).toEqual({ x: -1, y: -1 })
  })

  it('Math.random 返回特定值时可预测结果', () => {
    // Mock Math.random 返回 0，应该落在网格最前面非蛇身位置
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const snake = [{ x: 0, y: 0 }]
    const food = randomFood(snake)
    // random=0 → x=0, y=0 — 但 (0,0) 被占了，
    // 因为有重试机制，所以会多次调用 random
    // 这里只验证返回的位置有效且不在蛇身上
    expect(food.x).toBeGreaterThanOrEqual(0)
    expect(food.x).toBeLessThan(GRID_COUNT)
    const isOnSnake = snake.some((s) => s.x === food.x && s.y === food.y)
    expect(isOnSnake).toBe(false)
    vi.restoreAllMocks()
  })
})

// ============================================================
// getSpeed — 速度计算
// ============================================================
describe('getSpeed', () => {
  it('分数 0 时返回基础速度 150', () => {
    expect(getSpeed(0)).toBe(150)
  })
  it('分数 10 时返回 120', () => {
    expect(getSpeed(10)).toBe(120)
  })
  it('分数 20 时返回 90', () => {
    expect(getSpeed(20)).toBe(90)
  })
  it('分数 30 时返回 60（触底）', () => {
    expect(getSpeed(30)).toBe(60)
  })
  it('分数 50 时也返回 60，不会低于 60', () => {
    expect(getSpeed(50)).toBe(60)
    expect(getSpeed(100)).toBe(60)
  })
  it('分数越高速度值越低（不会递增）', () => {
    // 速度值随时间递减（越小越快），验证单调不增
    let prev = getSpeed(0)
    for (let score = 1; score <= 40; score++) {
      const current = getSpeed(score)
      expect(current).toBeLessThanOrEqual(prev)
      prev = current
    }
  })
  it('负数分数的处理', () => {
    // 不应该出现负数分数，但函数应该能处理
    const speed = getSpeed(-10)
    expect(speed).toBe(180) // 150 - (-30) = 180
  })
})
