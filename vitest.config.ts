
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./server/__tests__/setup.ts'],
    include: ['server/__tests__/**/*.test.ts'],
    fileParallelism: false
  },
  resolve: {
    alias: {
      '#imports': path.resolve(__dirname, './.nuxt/imports.d.ts'),
      '~': path.resolve(__dirname, '.'),
      '@': path.resolve(__dirname, '.')
    }
  }
})
