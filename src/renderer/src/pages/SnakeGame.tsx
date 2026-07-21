import { useRef, useEffect, useState, useCallback } from 'react'
import { Card, Button, Space, Tag, message } from 'antd'
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  ReloadOutlined
} from '@ant-design/icons'

// --- 游戏常量 ---
const CANVAS_SIZE = 400
const GRID_COUNT = 20
const CELL_SIZE = CANVAS_SIZE / GRID_COUNT
const BASE_SPEED = 150 // 基础速度（毫秒/帧），越小越快
const TOTAL_CELLS = GRID_COUNT * GRID_COUNT // 20×20 = 400

// 方向
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'
type Position = { x: number; y: number }

// 方向对应的向量
const DIR_VECTORS: Record<Direction, Position> = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 }
}

// 禁止反向：不能按反方向导致蛇撞自己
const OPPOSITE: Record<Direction, Direction> = {
  UP: 'DOWN',
  DOWN: 'UP',
  LEFT: 'RIGHT',
  RIGHT: 'LEFT'
}

// 键盘按键 → 方向映射（模块级别，避免每次按键重新创建）
const KEY_MAP: Record<string, Direction> = {
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

// --- 工具函数 ---
function randomFood(snake: Position[]): Position {
  // 蛇占满所有格子 → 返回原点（外部应检测为胜利）
  if (snake.length >= TOTAL_CELLS) {
    return { x: -1, y: -1 }
  }
  // 限制重试次数，防止快满时长时间循环
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
  // 兜底：顺序扫描找第一个空位
  for (let y = 0; y < GRID_COUNT; y++) {
    for (let x = 0; x < GRID_COUNT; x++) {
      if (!snake.some((s) => s.x === x && s.y === y)) {
        return { x, y }
      }
    }
  }
  return { x: -1, y: -1 }
}

function getSpeed(score: number): number {
  // 分数越高速度越快，最低 60ms
  return Math.max(60, BASE_SPEED - score * 3)
}

// --- 游戏状态类型 ---
type GameState = 'idle' | 'playing' | 'paused' | 'over'

function SnakeGame(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [gameState, setGameState] = useState<GameState>('idle')
  const [score, setScore] = useState(0)
  const [bestScore, setBestScore] = useState(0)

  // 用 ref 存储可变游戏数据，避免闭包陷阱
  const snakeRef = useRef<Position[]>([])
  const foodRef = useRef<Position>({ x: 10, y: 10 })
  const directionRef = useRef<Direction>('RIGHT')
  const nextDirRef = useRef<Direction>('RIGHT')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scoreRef = useRef(0)
  const stateRef = useRef<GameState>('idle')
  const bestScoreRef = useRef(0)

  // --- 绘制 ---
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 高 DPI 支持
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

    // 清空画布
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

    // 画网格线（淡色）
    ctx.strokeStyle = '#16213e'
    ctx.lineWidth = 0.5
    for (let i = 0; i <= GRID_COUNT; i++) {
      ctx.beginPath()
      ctx.moveTo(i * CELL_SIZE, 0)
      ctx.lineTo(i * CELL_SIZE, CANVAS_SIZE)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, i * CELL_SIZE)
      ctx.lineTo(CANVAS_SIZE, i * CELL_SIZE)
      ctx.stroke()
    }

    // 画食物
    const fx = food.x * CELL_SIZE
    const fy = food.y * CELL_SIZE
    ctx.fillStyle = '#ff6b6b'
    ctx.shadowColor = '#ff6b6b'
    ctx.shadowBlur = 8
    ctx.beginPath()
    ctx.arc(fx + CELL_SIZE / 2, fy + CELL_SIZE / 2, CELL_SIZE / 2 - 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0

    // 画蛇
    snake.forEach((seg, i) => {
      const sx = seg.x * CELL_SIZE
      const sy = seg.y * CELL_SIZE
      const padding = 1

      if (i === 0) {
        // 蛇头
        ctx.fillStyle = '#00d2ff'
        ctx.shadowColor = '#00d2ff'
        ctx.shadowBlur = 6
        ctx.fillRect(sx + padding, sy + padding, CELL_SIZE - padding * 2, CELL_SIZE - padding * 2)
        ctx.shadowBlur = 0
        // 眼睛
        ctx.fillStyle = '#fff'
        const eyeSize = 3
        const dir = directionRef.current
        let ex1: number, ey1: number, ex2: number, ey2: number
        const cx = sx + CELL_SIZE / 2
        const cy = sy + CELL_SIZE / 2
        const offset = 5
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
        // 蛇身 — 渐变绿色
        const ratio = 1 - i / Math.max(snake.length - 1, 1)
        const g = Math.floor(180 + ratio * 75)
        const b = Math.floor(100 + ratio * 155)
        ctx.fillStyle = `rgb(0, ${g}, ${b})`
        ctx.fillRect(sx + padding, sy + padding, CELL_SIZE - padding * 2, CELL_SIZE - padding * 2)
      }
    })

    // 暂停/结束遮罩
    if (stateRef.current === 'paused') {
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 32px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('⏸ 已暂停', CANVAS_SIZE / 2, CANVAS_SIZE / 2)
      ctx.textAlign = 'start'
    }
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

  // --- 游戏结束 ---
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

  // --- 游戏逻辑 ---
  const tick = useCallback(() => {
    try {
      const dir = nextDirRef.current
      directionRef.current = dir
      const vec = DIR_VECTORS[dir]
      const head = snakeRef.current[0]
      const newHead: Position = { x: head.x + vec.x, y: head.y + vec.y }

      // 撞墙
      if (newHead.x < 0 || newHead.x >= GRID_COUNT || newHead.y < 0 || newHead.y >= GRID_COUNT) {
        endGame()
        return
      }

      // 撞自己（排除尾部最后一段，因为没吃到食物时尾部会移除）
      const willEat = newHead.x === foodRef.current.x && newHead.y === foodRef.current.y
      const tailIndex = willEat ? snakeRef.current.length : snakeRef.current.length - 1
      for (let i = 0; i < tailIndex; i++) {
        const s = snakeRef.current[i]
        if (s.x === newHead.x && s.y === newHead.y) {
          endGame()
          return
        }
      }

      const ate = willEat
      const newSnake = [newHead, ...snakeRef.current]
      if (!ate) {
        newSnake.pop() // 去掉尾巴
      }

      snakeRef.current = newSnake

      if (ate) {
        const s = scoreRef.current + 10
        scoreRef.current = s
        setScore(s)

        // 胜利检查：蛇占满整个网格
        if (newSnake.length >= TOTAL_CELLS) {
          // 更新最高分后结束
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

        foodRef.current = randomFood(newSnake)

        // 调整速度
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = setInterval(tick, getSpeed(s))
        }
      }

      draw()
    } catch (err) {
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

  // --- 控制方法 ---
  const startGame = useCallback((initialDirection?: Direction): void => {
    const initSnake: Position[] = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 }
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

    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(tick, BASE_SPEED)
  }, [draw, tick])

  const togglePause = useCallback((): void => {
    if (stateRef.current === 'playing') {
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = null
      stateRef.current = 'paused'
      setGameState('paused')
      draw()
    } else if (stateRef.current === 'paused') {
      stateRef.current = 'playing'
      setGameState('playing')
      draw()
      timerRef.current = setInterval(tick, getSpeed(scoreRef.current))
    }
  }, [draw, tick])

  // --- 初始绘制（组件挂载时显示空闲画面）---
  useEffect(() => {
    draw()
  }, [draw])

  // --- Canvas 上下文丢失处理 ---
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function handleContextLost(e: Event): void {
      e.preventDefault()
      // 暂停游戏，防止状态继续变化
      if (stateRef.current === 'playing') {
        if (timerRef.current) clearInterval(timerRef.current)
        timerRef.current = null
        stateRef.current = 'paused'
        setGameState('paused')
      }
    }

    function handleContextRestored(): void {
      // 上下文恢复后重绘
      draw()
    }

    canvas.addEventListener('contextlost', handleContextLost)
    canvas.addEventListener('contextrestored', handleContextRestored)
    return () => {
      canvas.removeEventListener('contextlost', handleContextLost)
      canvas.removeEventListener('contextrestored', handleContextRestored)
    }
  }, [draw])

  // --- 键盘控制 ---
  useEffect(() => {
    const handleKey = (e: KeyboardEvent): void => {
      const state = stateRef.current

      // 空格：开始/暂停
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

      const dir = KEY_MAP[e.key]
      if (!dir) return
      e.preventDefault()

      if (state === 'idle' || state === 'over') {
        // 传递用户选择的初始方向
        startGame(dir)
        return
      }

      if (state !== 'playing') return

      // 不能反向
      if (OPPOSITE[dir] !== directionRef.current) {
        nextDirRef.current = dir
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [startGame, togglePause])

  // 清理
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  return (
    <div>
      <h2 className="page-title">🐍 贪吃蛇</h2>

      <Card style={{ maxWidth: 460, margin: '0 auto' }}>
        {/* 分数栏 */}
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

        {/* 画布 */}
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          style={CANVAS_STYLE}
        />

        {/* 按钮 */}
        <div style={BUTTON_ROW_STYLE}>
          <Space size={12}>
            {gameState === 'idle' || gameState === 'over' ? (
              <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => startGame()} size="large">
                {gameState === 'over' ? '再来一局' : '开始游戏'}
              </Button>
            ) : (
              <Button
                icon={gameState === 'paused' ? <PlayCircleOutlined /> : <PauseCircleOutlined />}
                onClick={togglePause}
                size="large"
              >
                {gameState === 'paused' ? '继续' : '暂停'}
              </Button>
            )}
            {gameState !== 'idle' && (
              <Button icon={<ReloadOutlined />} onClick={() => startGame()} size="large">
                重新开始
              </Button>
            )}
          </Space>
        </div>

        {/* 操作说明 */}
        <div style={HELP_TEXT_STYLE}>
          方向键 ↑↓←→ 或 WASD 控制方向 ｜ 空格键 开始/暂停
        </div>
      </Card>
    </div>
  )
}

// 模块级别样式常量，避免每次渲染重新创建
const SCORE_BAR_STYLE: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 16
}

const CANVAS_STYLE: React.CSSProperties = {
  display: 'block',
  borderRadius: 8,
  border: '2px solid #1677ff',
  margin: '0 auto',
  maxWidth: '100%'
}

const BUTTON_ROW_STYLE: React.CSSProperties = {
  textAlign: 'center',
  marginTop: 16
}

const HELP_TEXT_STYLE: React.CSSProperties = {
  textAlign: 'center',
  marginTop: 12,
  color: '#8c8c8c',
  fontSize: 12
}

export default SnakeGame
