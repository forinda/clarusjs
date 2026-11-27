// The docs site under a base (/clarusjs/): pages, Markdown links, the theme's nav and sidebar, public files,
// scripts, search, lesson progress and client routes all stay under it.
import { expect, test, type Page } from '@playwright/test'

const BASE = '/clarusjs/'
/** Every same-origin URL a page refers to (links, images, scripts, stylesheets, icons). */
const urls = (page: Page) => page.evaluate(() => [...document.querySelectorAll('[href], [src]')].flatMap((el) => {
  const raw = el.getAttribute('href') ?? el.getAttribute('src') ?? ''
  if (!raw.startsWith('/') || raw.startsWith('//')) return []
  return [raw]
}))

test('pages refer only to URLs under the base, and those load', async ({ page, request }) => {
  const errors: string[] = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  const seen = new Set<string>()
  for (const path of ['', 'guide/deploy', 'guide/markdown', 'learn/first-page', 'components/dialog']) {
    const res = await page.goto(BASE + path)
    expect(res?.status(), path).toBe(200)
    const found = await urls(page)
    expect(found.filter((u) => !u.startsWith(BASE)), path).toEqual([])
    for (const u of found) seen.add(u.split('#')[0]!)
  }
  for (const u of [...seen].filter((x) => !x.includes('/assets/')).slice(0, 60)) {
    expect((await request.get(u)).status(), u).toBe(200)
  }
  expect(errors).toEqual([])
})

test('the sidebar and a Markdown link navigate within the base', async ({ page }) => {
  await page.goto(BASE + 'guide/deploy')
  await page.locator('.sidebar a[href$="/guide/routing"]').first().click()
  await expect(page).toHaveURL(/\/clarusjs\/guide\/routing$/)
  await page.locator('main a[href^="/clarusjs/guide/"]').first().click()
  await expect(page).toHaveURL(/\/clarusjs\/guide\//)
})

test('search results link under the base', async ({ page }) => {
  await page.goto(BASE + 'guide/holes')
  await expect(page.locator('cl-island[c="search"]')).toHaveAttribute('data-cl-ready', '')
  await page.keyboard.press('Control+k')
  const dialog = page.locator('dialog.search-dialog')
  await dialog.getByRole('combobox', { name: 'Search the docs' }).fill('fragment navig')
  const result = dialog.getByRole('option').first().locator('a')
  await expect(result).toContainText('Fragment navigation')
  expect(await result.getAttribute('href')).toMatch(/^\/clarusjs\/guide\/fragment-navigation/)
})

test('lesson progress marks the sidebar\'s lessons under the base', async ({ page }) => {
  await page.goto(BASE + 'learn/progress')
  await expect(page.locator('.sidebar ul a[href="/clarusjs/learn/first-page"]')).toHaveAttribute('data-status', 'current')
})

test('a client route (the tour) navigates without leaving the base', async ({ page }) => {
  await page.goto(BASE + 'tour/1')
  const link = page.locator('main a[href^="/clarusjs/tour/2"]').first()
  await link.click()
  await expect(page).toHaveURL(/\/clarusjs\/tour\//)
  expect((await urls(page)).filter((u) => !u.startsWith(BASE))).toEqual([])
})
