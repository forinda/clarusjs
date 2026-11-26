import { defineConfig, devices } from '@playwright/test'

// The tests run against the built site (vite build + vite preview), never the dev server.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  // A failing test keeps its trace in test-results/ (CI uploads that folder): open it with `npx playwright show-trace`.
  use: { baseURL: 'http://localhost:4397', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm build && pnpm preview --port 4397 --strictPort',
    env: { NO_ANALYTICS: '1' }, // no Tag Manager in the tested build (src/head.ts)
    url: 'http://localhost:4397',
    // Never test a stale build: a server already on the port is an error, not something to reuse.
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
