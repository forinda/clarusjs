import { defineConfig } from 'vitest/config'

// The end-to-end test runs the built server: build it once first.
export default defineConfig({ test: { globalSetup: ['test/build.setup.ts'] } })
