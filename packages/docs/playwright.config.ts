import { defineConfig, devices } from '@playwright/test'

// The tests run against the built site (vite build + vite preview), never the dev server.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:4321' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm build && pnpm preview --port 4321 --strictPort',
    url: 'http://localhost:4321',
    // Never test a stale build: a server already on the port is an error, not something to reuse.
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
