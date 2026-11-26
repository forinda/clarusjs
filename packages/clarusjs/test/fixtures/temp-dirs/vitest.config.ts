import { defineConfig } from 'vitest/config'

// The fixture's own Vitest, with the suite's shared setup (removes the temp directories a test file made).
export default defineConfig({
  test: { include: ['leak.check.ts'], setupFiles: ['../../../../../scripts/vitest-temp-dirs.ts'] },
})
