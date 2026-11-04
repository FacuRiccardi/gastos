import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    // Date-dependent tests must not depend on the machine's time zone: force UTC, so code that is
    // supposed to use an explicit time zone (formatDate) is really being tested.
    env: { TZ: 'UTC' },
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
