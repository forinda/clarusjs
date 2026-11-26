// Pagination's demo: its links used to load this same static page again (?page=2), a swap that flickered and changed
// nothing. They stay on the page now.
import { expect, test } from '@playwright/test'

test('a demo page link loads nothing and keeps the page where it is', async ({ page }) => {
  const loads: string[] = []
  page.on('request', (r) => { if (/pagination/.test(r.url())) loads.push(r.url()) })
  await page.goto('/components/pagination')
  await page.waitForLoadState('networkidle')
  loads.length = 0
  const nav = page.getByRole('navigation', { name: 'Pagination', exact: true })
  await expect(nav.getByRole('link', { name: '2' })).toHaveAttribute('href', '#page-2')
  const top = await page.evaluate(() => scrollY)
  await nav.getByRole('link', { name: '2' }).click()
  await page.waitForTimeout(500)
  expect(loads).toEqual([])
  expect(await page.evaluate(() => scrollY)).toBe(top)
})
