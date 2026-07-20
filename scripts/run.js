// Helper script: remove ELECTRON_RUN_AS_NODE before running electron-vite.
// This env var (when set) forces Electron to run as plain Node.js,
// which prevents the Electron API from loading.

delete process.env.ELECTRON_RUN_AS_NODE

const { spawn } = require('child_process')
const command = process.argv[2] || 'dev'

console.log(`正在启动黑马记账 (electron-vite ${command})...`)

const child = spawn('npx', ['electron-vite', command], {
  stdio: 'inherit',
  env: process.env,
  shell: true
})

child.on('close', (code) => {
  process.exit(code ?? 0)
})
