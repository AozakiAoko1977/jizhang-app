import { resolve } from 'path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer/src')
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/renderer/src/__tests__/test-setup.ts'],
    css: {
      modules: {
        classNameStrategy: 'non-scoped'
      }
    },
    include: ['src/renderer/src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['src/main/**', 'src/preload/**', 'node_modules', 'out']
  }
})
