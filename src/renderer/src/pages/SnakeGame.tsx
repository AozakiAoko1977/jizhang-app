/**
 * SnakeGame.tsx — 贪吃蛇小游戏
 * =============================================
 *
 * 这是黑马记账 App 内置的一个休闲小游戏——经典贪吃蛇。
 *
 * 技术方案：
 *   使用 HTML5 Canvas 来绘制游戏画面（不用 DOM 元素，因为 Canvas 适合高频重绘）。
 *   游戏循环用 setInterval 驱动，每帧调用 draw() 重绘画布。
 *
 * 为什么用 useRef 而不是 useState 存储游戏数据？
 *   React 的 useState 更新是异步的，而游戏循环（setInterval 的 tick 函数）
 *   需要实时读取最新的蛇位置、方向、分数等数据。如果用 useState，
 *   会因为 JavaScript 闭包问题读到"过时的旧值"。
 *   useRef 存储的值是同步读写的，每次 .current 都能拿到最新数据，
 *   完美适合这种高频更新的游戏场景。
 *
 * 游戏状态机（一图看懂）：
 *   idle（初始）  ──▶ playing（进行中） ──▶ paused（暂停）
 *                      │     ▲       │         │
 *                      │     └───────┘         │
 *                      ▼                       │
 *                   over（结束） ◀──────────────┘
 *
 * 键盘操作：
 *   方向键 ↑↓←→ 或 WASD — 控制蛇的移动方向
 *   空格键 — 开始游戏 / 暂停-继续
 */

import { useRef, useEffect, useState, useCallback } from 'react'
import { Card, Button, Space, Tag, message } from 'antd'
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  ReloadOutlined
} from '@ant-design/icons'

// ============================================================
// 游戏常量 — 放在模块级别，所有函数共享同一份，避免重复创建
// ============================================================

/** 画布尺寸（像素），正方形 */
const CANVAS_SIZE = 400
/** 网格数量，20×20 的棋盘 */
export const GRID_COUNT = 20
/** 每个格子的像素大小 = 400÷20 = 20px */
const CELL_SIZE = CANVAS_SIZE / GRID_COUNT
/** 基础移动速度（毫秒），每 150ms 移动一格，值越小蛇越快 */
const BASE_SPEED = 150
/** 网格总数 = 20×20 = 400，用于判断胜利条件（蛇占满所有格子） */
export const TOTAL_CELLS = GRID_COUNT * GRID_COUNT

// ============================================================
// 类型定义
// ============================================================

/** 蛇的移动方向 */
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'
/** 坐标位置（格子坐标，不是像素坐标） */
type Position = { x: number; y: number }

// ============================================================
// 游戏常量映射表 — 模块级别定义，避免每次按键重新创建对象
// ============================================================

/**
 * 方向 → 坐标变化量的映射
 * 比如当前朝右(RIGHT)，每次移动 x+1, y不变
 */
export const DIR_VECTORS: Record<Direction, Position> = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 }
}

/**
 * 反向映射表 — 用于防止蛇掉头撞到自己
 * 比如当前朝右(RIGHT)，反向是 LEFT，用户按左键会被忽略
 */
export const OPPOSITE: Record<Direction, Direction> = {
  UP: 'DOWN',
  DOWN: 'UP',
  LEFT: 'RIGHT',
  RIGHT: 'LEFT'
}

/**
 * 键盘按键 → 方向的映射表
 * 支持方向键（ArrowUp/Down/Left/Right）和 WASD 两套按键方案
 * 大写和小写都支持（W 和 w 都是向上）
 */
export const KEY_MAP: Record<string, Direction> = {
  ArrowUp: 'UP',
  ArrowDown: 'DOWN',
  ArrowLeft: 'LEFT',
  ArrowRight: 'RIGHT',
  w: 'UP',
  W: 'UP',
  s: 'DOWN',
  S: 'DOWN',
  a: 'LEFT',
  A: 'LEFT',
  d: 'RIGHT',
  D: 'RIGHT'
}

// ============================================================
// 工具函数
// ============================================================

/**
 * 在 20×20 网格中随机生成食物位置
 *
 * @param snake - 当前蛇身所有格子的位置列表
 * @returns 一个不在蛇身上的随机格子坐标
 *
 * 算法分三步（层层递进，确保总能在有空格时返回结果）：
 *   ① 如果蛇占满了（格子总数 = 蛇长）→ 返回 (-1, -1) 表示胜利
 *   ② 随机重试（最多 1200 次）——大多数情况这一步就够了
 *   ③ 如果重试用完还没找到 → 兜底方案：顺序扫描整个网格找第一个空位
 */
export function randomFood(snake: Position[]): Position {
  // 蛇占满所有格子 → 游戏胜利，返回无效坐标，调用方会检测为胜利
  if (snake.length >= TOTAL_CELLS) {
    return { x: -1, y: -1 }
  }
  // 随机重试：随机生成坐标，检查是否和蛇身重叠
  // 重试上限 = 1200 次（400 格 × 3），防止快满时死循环太久
  const maxRetries = TOTAL_CELLS * 3
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const pos: Position = {
      x: Math.floor(Math.random() * GRID_COUNT),
      y: Math.floor(Math.random() * GRID_COUNT)
    }
    if (!snake.some((s) => s.x === pos.x && s.y === pos.y)) {
      return pos
    }
  }
  // 兜底：从左上角开始逐格扫描，找到第一个空位
  for (let y = 0; y < GRID_COUNT; y++) {
    for (let x = 0; x < GRID_COUNT; x++) {
      if (!snake.some((s) => s.x === x && s.y === y)) {
        return { x, y }
      }
    }
  }
  return { x: -1, y: -1 }
}

/**
 * 根据当前分数计算游戏速度
 *
 * 速度公式：max(60, 150 - 分数×3)
 *   分数=0   → 150ms/帧（慢）
 *   分数=10  → 120ms/帧
 *   分数=20  →  90ms/帧
 *   分数=30+ →  60ms/帧（最快，不再加速）
 *
 * 这样设计是为了让游戏逐渐变难——分数越高蛇越快。
 */
export function getSpeed(score: number): number {
  return Math.max(60, BASE_SPEED - score * 3)
}

/** 游戏四种状态 */
type GameState = 'idle' | 'playing' | 'paused' | 'over'

// ============================================================
// SnakeGame 组件
// ============================================================

/**
 * SnakeGame — 贪吃蛇游戏组件
 *
 * 核心设计：
 *   使用 Canvas 渲染游戏画面，用 setInterval 驱动游戏循环。
 *
 *   为什么状态用 useRef？
 *     游戏循环是在 setInterval 里跑的，React 的 useState 更新
 *     是异步的，闭包里的值可能是旧的。useRef 是同步读写，
 *     每次 .current 都能拿到最新值，适合高频操作的游戏。
 *
 *   哪些数据用 useRef？
 *     - snake、food、direction：每帧都在变，必须实时读取
 *     - score、state、bestScore：游戏循环里要判断，也需要实时
 *     - timerRef：存储定时器 ID，用于启动/停止
 *
 *   哪些数据用 useState？
 *     - gameState：需要触发 React 重新渲染（按钮文字跟着变）
 *     - score、bestScore：需要在页面上实时显示
 *     （注意：score 同时存了 ref 和 state——ref 给 tick 函数读，
 *       state 给页面显示，两者需要手动保持同步）
 */
function SnakeGame(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // useState 管理的状态：用于驱动 React 重新渲染界面
  const [gameState, setGameState] = useState<GameState>('idle')
  const [score, setScore] = useState(0)
  const [bestScore, setBestScore] = useState(0)

  // useRef 管理的游戏数据：游戏循环中实时读写，避免闭包陷阱
  const snakeRef = useRef<Position[]>([])                // 蛇身（每个格子的坐标数组）
  const foodRef = useRef<Position>({ x: 10, y: 10 })    // 食物位置
  const directionRef = useRef<Direction>('RIGHT')        // 当前移动方向
  const nextDirRef = useRef<Direction>('RIGHT')          // 下一步方向（用户按键写入这里）
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)  // 游戏定时器
  const scoreRef = useRef(0)                             // 分数（游戏循环中读这个）
  const stateRef = useRef<GameState>('idle')             // 游戏状态（游戏循环中读这个）
  const bestScoreRef = useRef(0)                         // 最高分

  // ==========================================================
  // 核心函数：绘制（Canvas 渲染）
  // ==========================================================

  /**
   * draw() — 绘制整个游戏画面
   *
   * 这是整个组件最核心的渲染函数。每次游戏循环 tick 都会调用它。
   *
   * 绘制顺序（越先画的越在底层，像 PS 的图层）：
   *   ① 清空画布 + 画深色背景
   *   ② 画网格线（淡色，20×20 格子）
   *   ③ 画食物（红色发光圆点）
   *   ④ 画蛇（绿色渐变身体 + 蓝色蛇头 + 白色眼睛）
   *   ⑤ 画遮罩层（暂停/结束/待开始时显示半透明覆盖文字）
   *
   * 高 DPI（Retina 屏）处理：
   *   有些屏幕像素密度是 2 倍甚至 3 倍（如 Mac Retina 屏），
   *   如果不处理高 DPI，Canvas 画面会模糊。
   *   做法：实际画布像素 = 逻辑尺寸 × DPI 倍数，然后用 CSS 保持逻辑尺寸。
   */
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // ===== 高 DPI 屏幕适配 =====
    // devicePixelRatio：设备的像素密度（普通屏=1，Retina屏=2或3）
    // canvas.width/height 是实际像素，canvas.style.width/height 是 CSS 显示尺寸
    // 比如 dpr=2 时：实际画 800×800 像素，但 CSS 显示为 400×400 → 画面清晰
    const dpr = window.devicePixelRatio || 1
    const logicalSize = CANVAS_SIZE
    if (canvas.width !== logicalSize * dpr || canvas.height !== logicalSize * dpr) {
      canvas.width = logicalSize * dpr
      canvas.height = logicalSize * dpr
      canvas.style.width = logicalSize + 'px'
      canvas.style.height = logicalSize + 'px'
      ctx.scale(dpr, dpr)
    }

    const snake = snakeRef.current
    const food = foodRef.current

    // ===== ① 背景 =====
    ctx.fillStyle = '#1a1a2e'      // 深蓝黑色背景
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

    // ===== ② 网格线 =====
    // 20×20 格子的淡色网格，帮助玩家判断蛇的位置
    ctx.strokeStyle = '#16213e'     // 比背景稍亮的蓝色
    ctx.lineWidth = 0.5
    for (let i = 0; i <= GRID_COUNT; i++) {
      // 画竖线
      ctx.beginPath()
      ctx.moveTo(i * CELL_SIZE, 0)
      ctx.lineTo(i * CELL_SIZE, CANVAS_SIZE)
      ctx.stroke()
      // 画横线
      ctx.beginPath()
      ctx.moveTo(0, i * CELL_SIZE)
      ctx.lineTo(CANVAS_SIZE, i * CELL_SIZE)
      ctx.stroke()
    }

    // ===== ③ 画食物 =====
    // 红色圆点 + 发光效果，中心对齐到格子中央
    const fx = food.x * CELL_SIZE
    const fy = food.y * CELL_SIZE
    ctx.fillStyle = '#ff6b6b'
    ctx.shadowColor = '#ff6b6b'
    ctx.shadowBlur = 8                // 红色发光光晕
    ctx.beginPath()
    ctx.arc(fx + CELL_SIZE / 2, fy + CELL_SIZE / 2, CELL_SIZE / 2 - 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0                // 关闭发光，避免影响后续绘制

    // ===== ④ 画蛇 =====
    snake.forEach((seg, i) => {
      const sx = seg.x * CELL_SIZE
      const sy = seg.y * CELL_SIZE
      const padding = 1               // 每个蛇身格子留 1px 间距，看起来像一节一节的

      if (i === 0) {
        // --- 蛇头（蓝色方块 + 白色眼睛）---
        ctx.fillStyle = '#00d2ff'
        ctx.shadowColor = '#00d2ff'
        ctx.shadowBlur = 6            // 蓝色发光
        ctx.fillRect(sx + padding, sy + padding, CELL_SIZE - padding * 2, CELL_SIZE - padding * 2)
        ctx.shadowBlur = 0

        // 画蛇头的两只白色眼睛（根据当前移动方向调整眼睛位置）
        ctx.fillStyle = '#fff'
        const eyeSize = 3
        const dir = directionRef.current
        let ex1: number, ey1: number, ex2: number, ey2: number
        const cx = sx + CELL_SIZE / 2   // 格子中心 x
        const cy = sy + CELL_SIZE / 2   // 格子中心 y
        const offset = 5                // 眼睛偏离中心的距离
        // 根据方向把两只眼睛放在蛇头的"前方"
        if (dir === 'RIGHT') {
          ex1 = cx + offset; ey1 = cy - 4; ex2 = cx + offset; ey2 = cy + 4
        } else if (dir === 'LEFT') {
          ex1 = cx - offset; ey1 = cy - 4; ex2 = cx - offset; ey2 = cy + 4
        } else if (dir === 'UP') {
          ex1 = cx - 4; ey1 = cy - offset; ex2 = cx + 4; ey2 = cy - offset
        } else {
          ex1 = cx - 4; ey1 = cy + offset; ex2 = cx + 4; ey2 = cy + offset
        }
        ctx.beginPath()
        ctx.arc(ex1, ey1, eyeSize, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(ex2, ey2, eyeSize, 0, Math.PI * 2)
        ctx.fill()
      } else {
        // --- 蛇身（绿色渐变：从蛇头到蛇尾颜色逐渐变淡）---
        // ratio：越靠近蛇头值越大（1），越靠近蛇尾值越小（0）
        const ratio = 1 - i / Math.max(snake.length - 1, 1)
        const g = Math.floor(180 + ratio * 75)     // 绿色通道：180→255
        const b = Math.floor(100 + ratio * 155)    // 蓝色通道：100→255
        ctx.fillStyle = `rgb(0, ${g}, ${b})`
        ctx.fillRect(sx + padding, sy + padding, CELL_SIZE - padding * 2, CELL_SIZE - padding * 2)
      }
    })

    // ===== ⑤ 状态遮罩层 =====
    // 非进行中状态时，在画面上方覆盖半透明层 + 提示文字

    // 暂停状态
    if (stateRef.current === 'paused') {
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 32px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('⏸ 已暂停', CANVAS_SIZE / 2, CANVAS_SIZE / 2)
      ctx.textAlign = 'start'
    }
    // 游戏结束
    if (stateRef.current === 'over') {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
      ctx.fillStyle = '#ff6b6b'
      ctx.font = 'bold 28px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('游戏结束', CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 10)
      ctx.fillStyle = '#ccc'
      ctx.font = '18px sans-serif'
      ctx.fillText(`得分: ${scoreRef.current}`, CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 30)
      ctx.textAlign = 'start'
    }
    // 待开始
    if (stateRef.current === 'idle') {
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 24px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('按"开始"或按空格键', CANVAS_SIZE / 2, CANVAS_SIZE / 2)
      ctx.textAlign = 'start'
    }
  }, [])

  // ==========================================================
  // 核心函数：游戏结束
  // ==========================================================

  /**
   * endGame() — 结束游戏
   *
   * 执行步骤：
   *   ① 清除游戏定时器（停止 tick 循环）
   *   ② 更新状态为 'over'（触发界面重新渲染，按钮变成"再来一局"）
   *   ③ 检查是否破了最高分 → 是的话弹出祝贺消息
   *   ④ 最后画一帧（显示"游戏结束"遮罩）
   */
  const endGame = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    stateRef.current = 'over'
    setGameState('over')
    const s = scoreRef.current
    const best = bestScoreRef.current
    if (s > best) {
      bestScoreRef.current = s
      setBestScore(s)
      message.success(`🎉 新纪录！${s} 分`)
    }
    draw()
  }, [draw])

  // ==========================================================
  // 核心函数：游戏循环（每帧调用）
  // ==========================================================

  /**
   * tick() — 游戏主循环，每秒调用多次（由 setInterval 驱动）
   *
   * 每帧做的事情：
   *   ① 读取用户按键的新方向，更新蛇头位置
   *   ② 检查撞墙 → 结束
   *   ③ 检查撞自己 → 结束
   *   ④ 检查是否吃到食物 → 加分、变长、生成新食物、加速
   *   ⑤ 没吃到食物 → 去掉蛇尾（蛇保持原长度移动）
   *   ⑥ 检查胜利条件（蛇占满 400 格）→ 完美通关
   *   ⑦ 调用 draw() 重绘画布
   */
  const tick = useCallback(() => {
    try {
      const dir = nextDirRef.current
      directionRef.current = dir
      const vec = DIR_VECTORS[dir]
      const head = snakeRef.current[0]
      // 根据当前方向计算新的蛇头位置
      const newHead: Position = { x: head.x + vec.x, y: head.y + vec.y }

      // 撞墙检测：蛇头超出 0~19 的范围
      if (newHead.x < 0 || newHead.x >= GRID_COUNT || newHead.y < 0 || newHead.y >= GRID_COUNT) {
        endGame()
        return
      }

      // 撞自己检测：新蛇头位置是否和蛇身（除尾部最后一节）重叠
      // 如果同时吃到食物，蛇尾不移除，所以要检查整个蛇身
      // 如果没吃到食物，蛇尾会被移掉，所以最后一节不需要检查
      const willEat = newHead.x === foodRef.current.x && newHead.y === foodRef.current.y
      const tailIndex = willEat ? snakeRef.current.length : snakeRef.current.length - 1
      for (let i = 0; i < tailIndex; i++) {
        const s = snakeRef.current[i]
        if (s.x === newHead.x && s.y === newHead.y) {
          endGame()
          return
        }
      }

      // 拼接新蛇身：[新蛇头, ...旧蛇身]
      const ate = willEat
      const newSnake = [newHead, ...snakeRef.current]
      if (!ate) {
        // 没吃到食物 → 去掉尾巴（蛇保持长度不变，看起来在移动）
        newSnake.pop()
      }

      snakeRef.current = newSnake

      // ===== 吃到了食物 =====
      if (ate) {
        const s = scoreRef.current + 10   // 每吃一个食物加 10 分
        scoreRef.current = s
        setScore(s)

        // 胜利检查：蛇长等于网格总数（400）= 占满整个画面
        if (newSnake.length >= TOTAL_CELLS) {
          if (s > bestScoreRef.current) {
            bestScoreRef.current = s
            setBestScore(s)
          }
          if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
          }
          stateRef.current = 'over'
          setGameState('over')
          message.success(`🏆 完美通关！${s} 分`)
          draw()
          return
        }

        // 生成新食物（确保不在蛇身上）
        foodRef.current = randomFood(newSnake)

        // 动态加速：分数变了 → 重新设置定时器间隔
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = setInterval(tick, getSpeed(s))
        }
      }

      // 每一帧都要重绘
      draw()
    } catch (err) {
      // 游戏循环出错 → 安全处理，避免定时器继续跑
      console.error('游戏循环出错：', err)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      stateRef.current = 'over'
      setGameState('over')
      draw()
    }
  }, [draw, endGame])

  // ==========================================================
  // 控制函数
  // ==========================================================

  /**
   * startGame() — 开始/重新开始游戏
   *
   * @param initialDirection - 可选，用户按键指定的初始方向（不传默认向右）
   *
   * 初始化：蛇在中间偏左（10,10），向右移动，长度 3 节
   */
  const startGame = useCallback((initialDirection?: Direction): void => {
    const initSnake: Position[] = [
      { x: 10, y: 10 },   // 蛇头
      { x: 9, y: 10 },    // 第 2 节
      { x: 8, y: 10 }     // 第 3 节
    ]
    const dir = initialDirection || 'RIGHT'
    snakeRef.current = initSnake
    directionRef.current = dir
    nextDirRef.current = dir
    foodRef.current = randomFood(initSnake)
    scoreRef.current = 0
    setScore(0)
    stateRef.current = 'playing'
    setGameState('playing')
    draw()

    // 启动游戏循环（setInterval 每隔 BASE_SPEED 毫秒调用一次 tick）
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(tick, BASE_SPEED)
  }, [draw, tick])

  /**
   * togglePause() — 切换暂停/继续
   *
   * 暂停 → 清除定时器，显示"已暂停"遮罩
   * 继续 → 重新启动定时器（速度基于当前分数）
   */
  const togglePause = useCallback((): void => {
    if (stateRef.current === 'playing') {
      // 进行中 → 暂停
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = null
      stateRef.current = 'paused'
      setGameState('paused')
      draw()
    } else if (stateRef.current === 'paused') {
      // 暂停 → 继续
      stateRef.current = 'playing'
      setGameState('playing')
      draw()
      timerRef.current = setInterval(tick, getSpeed(scoreRef.current))
    }
  }, [draw, tick])

  // ==========================================================
  // 生命周期副作用
  // ==========================================================

  /** 组件挂载时画一帧，显示"按开始"引导 */
  useEffect(() => {
    draw()
  }, [draw])

  /** Canvas 上下文丢失/恢复处理
   *  某些情况下浏览器会丢弃 Canvas 的绘制内容（如 GPU 切换），
   *  需要监听 contextlost/contextrestored 事件来暂停/重绘
   */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function handleContextLost(e: Event): void {
      e.preventDefault()
      // 上下文丢失 → 暂停游戏，防止状态在无画面时继续变化
      if (stateRef.current === 'playing') {
        if (timerRef.current) clearInterval(timerRef.current)
        timerRef.current = null
        stateRef.current = 'paused'
        setGameState('paused')
      }
    }

    function handleContextRestored(): void {
      // 上下文恢复 → 重新绘制画面
      draw()
    }

    canvas.addEventListener('contextlost', handleContextLost)
    canvas.addEventListener('contextrestored', handleContextRestored)
    return () => {
      canvas.removeEventListener('contextlost', handleContextLost)
      canvas.removeEventListener('contextrestored', handleContextRestored)
    }
  }, [draw])

  /**
   * 键盘事件监听
   *
   * 按键逻辑（空格键）：
   *   idle/over 状态 → 开始游戏
   *   playing/paused → 切换暂停
   *
   * 按键逻辑（方向键/WASD）：
   *   idle/over 状态 → 开始游戏并用该方向作为初始方向
   *   playing 状态 → 如果非反向，更新下一步方向
   *   paused 状态 → 忽略（游戏已暂停）
   */
  useEffect(() => {
    const handleKey = (e: KeyboardEvent): void => {
      const state = stateRef.current

      // 空格键：开始 / 暂停-继续
      if (e.key === ' ') {
        e.preventDefault()
        if (state === 'idle' || state === 'over') {
          startGame()
          return
        }
        if (state === 'playing' || state === 'paused') {
          togglePause()
          return
        }
      }

      // 方向键 / WASD
      const dir = KEY_MAP[e.key]
      if (!dir) return
      e.preventDefault()

      if (state === 'idle' || state === 'over') {
        // 还没开始 → 用用户按的方向作为初始移动方向
        startGame(dir)
        return
      }

      if (state !== 'playing') return

      // 不能反向：如果用户按了和当前方向相反的方向，忽略
      if (OPPOSITE[dir] !== directionRef.current) {
        nextDirRef.current = dir
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [startGame, togglePause])

  /** 组件卸载时清除定时器，防止内存泄漏 */
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // ==========================================================
  // 渲染
  // ==========================================================

  return (
    <div>
      <h2 className="page-title">🐍 贪吃蛇</h2>

      {/* 游戏卡片：居中显示，最大宽度 460px */}
      <Card style={{ maxWidth: 460, margin: '0 auto' }}>
        {/* 分数栏：当前分数 + 最高分 */}
        <div style={SCORE_BAR_STYLE}>
          <Space size="large">
            <span>
              得分：<Tag color="blue" style={{ fontSize: 16 }}>{score}</Tag>
            </span>
            <span>
              最高：<Tag color="gold" style={{ fontSize: 14 }}>{bestScore}</Tag>
            </span>
          </Space>
        </div>

        {/* Canvas 游戏画布 */}
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          style={CANVAS_STYLE}
        />

        {/* 按钮区：根据游戏状态切换显示 */}
        <div style={BUTTON_ROW_STYLE}>
          <Space size={12}>
            {/* idle 或 over → 显示"开始/再来一局" */}
            {gameState === 'idle' || gameState === 'over' ? (
              <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => startGame()} size="large">
                {gameState === 'over' ? '再来一局' : '开始游戏'}
              </Button>
            ) : (
              /* playing 或 paused → 显示"暂停/继续" */
              <Button
                icon={gameState === 'paused' ? <PlayCircleOutlined /> : <PauseCircleOutlined />}
                onClick={togglePause}
                size="large"
              >
                {gameState === 'paused' ? '继续' : '暂停'}
              </Button>
            )}
            {/* 游戏进行中或暂停时，显示"重新开始"按钮 */}
            {gameState !== 'idle' && (
              <Button icon={<ReloadOutlined />} onClick={() => startGame()} size="large">
                重新开始
              </Button>
            )}
          </Space>
        </div>

        {/* 操作提示 */}
        <div style={HELP_TEXT_STYLE}>
          方向键 ↑↓←→ 或 WASD 控制方向 ｜ 空格键 开始/暂停
        </div>
      </Card>
    </div>
  )
}

// ============================================================
// 样式常量 — 放在模块级别，避免每次组件渲染重新创建对象
// ============================================================

/** 分数栏样式：弹性布局，左右分布 */
const SCORE_BAR_STYLE: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 16
}

/** 画布样式：居中显示，蓝色边框，圆角 */
const CANVAS_STYLE: React.CSSProperties = {
  display: 'block',
  borderRadius: 8,
  border: '2px solid #1677ff',
  margin: '0 auto',
  maxWidth: '100%'
}

/** 按钮行样式：居中 */
const BUTTON_ROW_STYLE: React.CSSProperties = {
  textAlign: 'center',
  marginTop: 16
}

/** 操作提示文字样式：灰色小字，居中 */
const HELP_TEXT_STYLE: React.CSSProperties = {
  textAlign: 'center',
  marginTop: 12,
  color: '#8c8c8c',
  fontSize: 12
}

export default SnakeGame
