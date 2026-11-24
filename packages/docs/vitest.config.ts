import { defineConfig } from 'vitest/config'
import clarusjs from 'clarusjs/vite'

// Unit tests only: e2e/ holds the Playwright tests (pnpm docs:test). The guide project runs the testing guide's
// examples (test/guide/, shown on /guide/testing) with the clarusjs plugin, which compiles the .tscl they import.
export default defineConfig({
  test: {
    projects: [
      { test: { name: 'unit', include: ['test/**/*.test.ts'], exclude: ['test/guide/**'] } },
      { plugins: [clarusjs()], test: { name: 'guide', include: ['test/guide/*.test.ts'] } },
    ],
  },
})
