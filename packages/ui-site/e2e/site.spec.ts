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

test('a demo and the code right after it have room between them', async ({ page }) => {
  await page.goto('/components/button')
  const gaps = await page.locator('.content .demo').evaluateAll((demos) => demos.flatMap((d) => {
    let next = (d.closest('cl-island') ?? d).nextElementSibling
    return next?.classList.contains('code-block') ? [Math.round(next.getBoundingClientRect().top - d.getBoundingClientRect().bottom)] : []
  }))
  expect(gaps.length).toBeGreaterThan(3)
  for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(12)
})

test('headings sit closer to what they introduce than to what came before (button examples)', async ({ page }) => {
  await page.goto('/components/button')
  const gaps = await page.locator('.content h3').evaluateAll((hs) => hs.map((h) => {
    const prev = h.previousElementSibling!.getBoundingClientRect()
    const next = h.nextElementSibling!.getBoundingClientRect()
    const box = h.getBoundingClientRect()
    return { before: Math.round(box.top - prev.bottom), after: Math.round(next.top - box.bottom) }
  }))
  expect(gaps.length).toBeGreaterThan(5)
  for (const g of gaps.slice(1)) {
    expect(g.before, JSON.stringify(g)).toBeGreaterThanOrEqual(28)
    expect(g.after, JSON.stringify(g)).toBeLessThanOrEqual(12)
  }
})

test('/components/button: with other buttons, the secondary group stands apart at the end of the row', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/components/button')
  const demo = page.locator('[class*="button-actions-demo"]')
  const group = (await demo.locator('[data-part="button-group"]').boundingBox())!
  const draft = (await demo.getByRole('button', { name: 'Save draft' }).boundingBox())!
  const box = (await demo.boundingBox())!
  expect(group.x - (draft.x + draft.width)).toBeGreaterThan(40)
  expect(box.x + box.width - (group.x + group.width)).toBeLessThan(40)
})
