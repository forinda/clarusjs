import { defineConfig } from 'vitest/config'

// The end-to-end test runs the built server: build it once first.
// The setup file removes the temp directories each test file makes (#436).
export default defineConfig({
  test: { globalSetup: ['test/build.setup.ts'], setupFiles: ['../../scripts/vitest-temp-dirs.ts'] },
})
