// The introduction: a showcase of components in motion first, the theme's code folded away so the page reads short.
import { expect, test } from '@playwright/test'

test('a showcase of eight live tiles, each a link to its component', async ({ page }) => {
  await page.goto('/components')
  const tiles = page.locator('[data-showcase] a[href^="/components/"]')
  await expect(tiles).toHaveCount(8)
  for (const href of [
    '/components/toast',
    '/components/chart',
    '/components/otp-input',
    '/components/switch',
    '/components/calendar',
    '/components/button',
  ])
    await expect(page.locator(`[data-showcase] a[href="${href}"]`)).toBeVisible()
  const named = await tiles.evaluateAll((as) => as.every((a) => (a.textContent ?? '').trim().length > 0))
  expect(named).toBe(true)
})

test('the tiles move, unless the visitor asks for less motion', async ({ browser }) => {
  for (const reducedMotion of ['no-preference', 'reduce'] as const) {
    const page = await browser.newPage({ reducedMotion })
    await page.goto('/components')
    const moving = await page
      .locator('[data-showcase] *')
      .evaluateAll((els) => els.filter((el) => getComputedStyle(el).animationName !== 'none').length)
    if (reducedMotion === 'reduce') expect(moving).toBe(0)
    else expect(moving).toBeGreaterThanOrEqual(6)
    await page.close()
  }
})

test('the theme code is folded away: a summary says what is inside, opening it shows the code', async ({ page }) => {
  await page.goto('/components')
  const theme = page.locator('details', { has: page.locator('summary', { hasText: 'theme.css' }) })
  await expect(theme).not.toHaveAttribute('open')
  await expect(theme.locator('pre')).toBeHidden()
  // Folded, the component list is near: not past a wall of tokens.
  const gap = (await page.locator('main .component-list').first().boundingBox())!.y - (await theme.boundingBox())!.y
  expect(gap).toBeLessThan(600)
  await theme.locator('summary').click()
  await expect(theme.locator('pre')).toBeVisible()
  await expect(page.locator('details', { has: page.locator('summary', { hasText: 'tailwind.css' }) })).toHaveCount(1)
})

test('each tile centres its scene (at rest: motion reduced, so nothing is mid-slide)', async ({ browser }) => {
  const page = await browser.newPage({ reducedMotion: 'reduce' })
  await page.goto('/components')
  for (const scene of await page.locator('[data-showcase] .scene').all()) {
    const frame = (await scene.boundingBox())!
    const kids = await scene.evaluate((el) => {
      const r = [...el.children].map((c) => c.getBoundingClientRect())
      return { left: Math.min(...r.map((b) => b.left)), right: Math.max(...r.map((b) => b.right)) }
    })
    expect(Math.abs(kids.left - frame.x - (frame.x + frame.width - kids.right))).toBeLessThanOrEqual(4)
  }
})
