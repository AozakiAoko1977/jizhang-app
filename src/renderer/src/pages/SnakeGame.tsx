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

// --- 工具函数 ---
function randomFood(snake: Position[]): Position {
  let pos: Position
  do {
    pos = {
      x: Math.floor(Math.random() * GRID_COUNT),
      y: Math.floor(Math.random() * GRID_COUNT)
    }
  } while (snake.some((s) => s.x === pos.x && s.y === pos.y))
  return pos
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

  // --- 绘制 ---
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

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
        // 蛇头 — 亮绿色
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

  // --- 游戏逻辑 ---
  const tick = useCallback(() => {
    const dir = nextDirRef.current
    directionRef.current = dir
    const vec = DIR_VECTORS[dir]
    const head = snakeRef.current[0]
    const newHead: Position = { x: head.x + vec.x, y: head.y + vec.y }

    // 撞墙
    if (newHead.x < 0 || newHead.x >= GRID_COUNT || newHead.y < 0 || newHead.y >= GRID_COUNT) {
      gameOver()
      return
    }

    // 撞自己（不算尾巴，因为尾巴会移动）
    if (snakeRef.current.some((s) => s.x === newHead.x && s.y === newHead.y)) {
      gameOver()
      return
    }

    const ate = newHead.x === foodRef.current.x && newHead.y === foodRef.current.y
    const newSnake = [newHead, ...snakeRef.current]
    if (!ate) {
      newSnake.pop() // 去掉尾巴
    }

    snakeRef.current = newSnake

    if (ate) {
      const s = scoreRef.current + 10
      scoreRef.current = s
      setScore(s)
      foodRef.current = randomFood(newSnake)

      // 调整速度
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = setInterval(tick, getSpeed(s))
      }
    }

    draw()
  }, [draw])

  function gameOver(): void {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    stateRef.current = 'over'
    setGameState('over')
    const s = scoreRef.current
    if (s > bestScore) {
      setBestScore(s)
      message.success(`🎉 新纪录！${s} 分`)
    }
    draw()
  }

  // --- 控制方法 ---
  function startGame(): void {
    const initSnake: Position[] = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 }
    ]
    snakeRef.current = initSnake
    directionRef.current = 'RIGHT'
    nextDirRef.current = 'RIGHT'
    foodRef.current = randomFood(initSnake)
    scoreRef.current = 0
    setScore(0)
    stateRef.current = 'playing'
    setGameState('playing')
    draw()

    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(tick, BASE_SPEED)
  }

  function togglePause(): void {
    if (stateRef.current === 'playing') {
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = null
      stateRef.current = 'paused'
      setGameState('paused')
      draw()
    } else if (stateRef.current === 'paused') {
      stateRef.current = 'playing'
      setGameState('playing')
      timerRef.current = setInterval(tick, getSpeed(scoreRef.current))
    }
  }

  // --- 键盘控制 ---
  useEffect(() => {
    function handleKey(e: KeyboardEvent): void {
      const state = stateRef.current
      const keyMap: Record<string, Direction> = {
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

      const dir = keyMap[e.key]
      if (!dir) return
      e.preventDefault()

      if (state === 'idle' || state === 'over') {
        nextDirRef.current = dir
        startGame()
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
  }, [])

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
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16
          }}
        >
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
          style={{
            display: 'block',
            borderRadius: 8,
            border: '2px solid #1677ff',
            margin: '0 auto',
            maxWidth: '100%'
          }}
        />

        {/* 按钮 */}
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Space size={12}>
            {gameState === 'idle' || gameState === 'over' ? (
              <Button type="primary" icon={<PlayCircleOutlined />} onClick={startGame} size="large">
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
            <Button icon={<ReloadOutlined />} onClick={startGame} size="large">
              重新开始
            </Button>
          </Space>
        </div>

        {/* 操作说明 */}
        <div
          style={{
            textAlign: 'center',
            marginTop: 12,
            color: '#8c8c8c',
            fontSize: 12
          }}
        >
          方向键 ↑↓←→ 或 WASD 控制方向 ｜ 空格键 开始/暂停
        </div>
      </Card>
    </div>
  )
}

export default SnakeGame
