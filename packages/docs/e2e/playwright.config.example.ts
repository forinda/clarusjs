// playwright.config.ts: build your site, serve it with vite preview, and run the tests in e2e/ against it.
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:4173' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'vite build && vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
  },
})
