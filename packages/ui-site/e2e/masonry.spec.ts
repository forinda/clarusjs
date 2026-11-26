// Masonry: items in columns at their own heights (CSS multi-column: no JavaScript), as many columns as fit.
import { expect, test } from '@playwright/test'
import { axeViolations, modes, pageIn } from './helpers.ts'

const columnsOf = (items: import('@playwright/test').Locator) =>
  items.evaluateAll((els) => new Set(els.map((el) => Math.round(el.getBoundingClientRect().left))).size)

test('the gallery: several columns on a wide screen, one on a phone; no photo split across columns', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/components/masonry')
  const gallery = page.locator('.demo:not(.example) [data-part="masonry"]')
  const items = gallery.locator('> figure')
  expect(await items.count()).toBeGreaterThanOrEqual(10)
  expect(await columnsOf(items)).toBeGreaterThanOrEqual(3)
  expect(await items.first().evaluate((el) => getComputedStyle(el).breakInside)).toBe('avoid')
  await page.setViewportSize({ width: 390, height: 800 })
  expect(await columnsOf(items)).toBe(1)
})

test('photos load lazily, keep their space while loading, and say what they show', async ({ page }) => {
  await page.goto('/components/masonry')
  for (const img of await page.locator('.demo:not(.example) [data-part="masonry"] img').all()) {
    await expect(img).toHaveAttribute('loading', 'lazy')
    await expect(img).toHaveAttribute('width', /\d+/)
    await expect(img).toHaveAttribute('height', /\d+/)
    await expect(img).toHaveAttribute('alt', /\S/)
    await expect(img).toHaveAttribute('src', /^https:\/\/picsum\.photos\/seed\//)
  }
})

test('any content: the cards example keeps text cards whole, in columns', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/components/masonry')
  const cards = page.locator('[class*="masonry-cards-demo"] [data-part="masonry"] > *')
  expect(await columnsOf(cards)).toBeGreaterThanOrEqual(2)
})

test('the introduction shows it among its tiles', async ({ page }) => {
  await page.goto('/components')
  await expect(page.locator('[data-showcase] a[href="/components/masonry"]')).toBeVisible()
})

for (const mode of modes) {
  test(`/components/masonry passes axe (${mode.label})`, async ({ browser }) => {
    const page = await pageIn(browser, mode)
    await page.goto('/components/masonry')
    expect(await axeViolations(page)).toEqual([])
  })
}
