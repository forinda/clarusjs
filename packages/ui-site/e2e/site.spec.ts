import { expect, test } from '@playwright/test'
import { axeViolations, modes, pageIn } from './helpers.ts'

test('introduction (/components): renders, offers theme.css to copy', async ({ page }) => {
  const response = await page.goto('/components')
  expect(response?.status()).toBe(200)
  await expect(page).toHaveTitle(/clarusjs ui/)
  const theme = page.locator('pre', { hasText: '--ui-accent:' })
  await expect(theme).toHaveCount(1)
  await expect(page.locator('.code-block', { has: theme }).getByRole('button', { name: /copy/i })).toHaveCount(1)
})

for (const mode of modes) {
  test(`introduction: passes axe (${mode.label})`, async ({ browser }) => {
    const page = await pageIn(browser, mode)
    await page.goto('/components')
    expect(await axeViolations(page)).toEqual([])
    await page.context().close()
  })
}
