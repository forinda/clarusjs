import { defineConfig } from 'vitest/config'

// Unit tests only: e2e/ holds the Playwright tests (pnpm docs:test).
export default defineConfig({ test: { include: ['test/**/*.test.ts'] } })
