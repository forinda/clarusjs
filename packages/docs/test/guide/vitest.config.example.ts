// vitest.config.ts: the clarusjs plugin compiles the .tscl files your tests import.
import { defineConfig } from 'vitest/config'
import clarusjs from 'clarusjs/vite'

export default defineConfig({
  plugins: [clarusjs()],
  test: { include: ['src/**/*.test.ts'] },
})
