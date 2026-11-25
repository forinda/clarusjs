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

test('the sidebar groups components the way PrimeVue does, in its order', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/components/button')
  const sidebar = page.locator('#sidebar')
  const titles = (await sidebar.locator('.group-title, summary, h2, h3').allTextContents()).map((t) => t.trim()).filter(Boolean)
  const order = ['Get started', 'Form', 'Button', 'Data', 'Panel', 'Overlay', 'Menu', 'Chart', 'Messages', 'Media', 'Misc']
  expect(titles.filter((t) => order.includes(t))).toEqual(order)
  // Each group shows its icon (an empty box looks broken).
  expect(await sidebar.locator('.group-icon').evaluateAll((boxes) => boxes.filter((b) => !b.querySelector('svg path')).length)).toBe(0)
})

test('/components lists the components under the same groups', async ({ page }) => {
  await page.goto('/components')
  const list = page.locator('.component-list')
  await expect(list.getByRole('heading', { name: 'Overlay' })).toBeVisible()
  await expect(list.locator('section', { has: page.getByRole('heading', { name: 'Overlay' }) }).getByRole('link', { name: 'Dialog', exact: true })).toBeVisible()
})
