import { defineConfig } from 'vitest/config'

// Removes the temp directories each test file makes (#436).
export default defineConfig({ test: { setupFiles: ['../../scripts/vitest-temp-dirs.ts'] } })
