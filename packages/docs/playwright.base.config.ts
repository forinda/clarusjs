import { defineConfig, devices } from '@playwright/test'

// The site built and served under a base (/clarusjs/, as on GitHub Pages): every link, file and script must stay
// under it. Its own tests (e2e-base/), on its own port; the main run (playwright.config.ts) is at the root.
export default defineConfig({
  testDir: 'e2e-base',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:4331', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm build --base /clarusjs/ && pnpm preview --base /clarusjs/ --port 4331 --strictPort',
    env: { NO_ANALYTICS: '1' },
    url: 'http://localhost:4331/clarusjs/',
    reuseExistingServer: false,
    timeout: 300_000,
  },
})
