// vitest.config.ts: the clarusjs plugin compiles the .tscl files your tests import.
import { defineConfig } from 'vitest/config'
import clarusjs from 'clarusjs/vite'

export default defineConfig({
  plugins: [clarusjs()],
  // Where your unit tests live; Playwright's e2e/*.spec.ts stay out of Vitest.
  test: { include: ['src/**/*.test.ts'] },
})
