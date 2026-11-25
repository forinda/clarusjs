// The chart (no JavaScript) and the interactive chart (range switch, tooltip by pointer and keys).
import { expect, test } from '@playwright/test'
import { axeViolations, modes, pageIn } from './helpers.ts'

test('/components/chart: an area chart and a bar chart, named images, coloured by the chart tokens', async ({ page }) => {
  await page.goto('/components/chart')
  const demo = page.locator('.demo')
  await expect(demo.getByRole('img', { name: 'Visitors this week' })).toBeVisible()
  await expect(demo.locator('[data-part="chart-area"]').first()).toHaveCSS('stroke', 'none')
  const line = demo.locator('[data-part="chart-line"]').first()
  const accent = await page.evaluate(() => getComputedStyle(document.querySelector('.demo')!).getPropertyValue('--ui-chart-1').trim())
  expect(accent).toMatch(/^#[0-9a-f]{6}$/i)
  await expect(line).toHaveCSS('stroke', await page.evaluate((hex) => { const p = document.createElement('p'); p.style.color = hex; document.body.append(p); const c = getComputedStyle(p).color; p.remove(); return c }, accent))
  await expect(demo.locator('[data-part="chart-bar"]').first()).toBeVisible()
})

/** The interactive demo, once attached. */
async function gotoInteractive(page: import('@playwright/test').Page) {
  await page.goto('/components/chart-interactive')
  await page.locator('cl-island[c="chart-interactive"][data-cl-ready]').first().waitFor({ state: 'attached' })
  return page.locator('.demo [data-part="chart-interactive"]')
}
const points = (chart: import('@playwright/test').Locator) => chart.locator('[data-part="chart-line"]').first().evaluate((p) => (p.getAttribute('d')!.match(/[ML]/g) ?? []).length)

test('chart-interactive: the range switch changes how many points are drawn', async ({ page }) => {
  const chart = await gotoInteractive(page)
  expect(await points(chart)).toBe(90)
  await chart.getByRole('button', { name: 'Last 30 days' }).click()
  await expect(chart.getByRole('button', { name: 'Last 30 days' })).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => points(chart)).toBe(30)
  await chart.getByRole('button', { name: 'Last 7 days' }).click()
  await expect.poll(() => points(chart)).toBe(7)
})

test('chart-interactive: the arrow keys move the tooltip over the points; Escape hides it', async ({ page }) => {
  const chart = await gotoInteractive(page)
  await chart.getByRole('button', { name: 'Last 7 days' }).click()
  const surface = chart.locator('[data-part="chart-surface"]')
  const tip = chart.locator('[data-part="chart-tooltip"]')
  await surface.focus()
  await page.keyboard.press('Home')
  await expect(tip).toBeVisible()
  const first = await tip.locator('strong').textContent()
  await page.keyboard.press('ArrowRight')
  await expect(tip.locator('strong')).not.toHaveText(first!)
  await expect(tip).toContainText('Desktop:')
  await page.keyboard.press('Escape')
  await expect(tip).toBeHidden()
})

test('chart-interactive: the tooltip follows the pointer', async ({ page }) => {
  const chart = await gotoInteractive(page)
  await chart.getByRole('button', { name: 'Last 7 days' }).click()
  const box = (await chart.locator('[data-part="chart-plot"]').boundingBox())!
  await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2)
  const tip = chart.locator('[data-part="chart-tooltip"]')
  await expect(tip).toBeVisible()
  const last = await tip.locator('strong').textContent()
  await page.mouse.move(box.x + 2, box.y + box.height / 2)
  await expect(tip.locator('strong')).not.toHaveText(last!)
})

for (const mode of modes) for (const name of ['chart', 'chart-interactive']) {
  test(`/components/${name} has no accessibility violations (${mode.label})`, async ({ browser }) => {
    const page = await pageIn(browser, mode)
    await page.goto(`/components/${name}`)
    expect(await axeViolations(page)).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}
