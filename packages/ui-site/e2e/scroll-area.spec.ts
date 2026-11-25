// Scroll area: a named, focusable region that scrolls (by keyboard too), with thin themed scrollbars. No JavaScript.
import { expect, test } from '@playwright/test'
import { axeViolations, modes, pageIn } from './helpers.ts'

test('a named region the keyboard can focus and scroll; thin scrollbars in the theme', async ({ page }) => {
  await page.goto('/components/scroll-area')
  const area = page.locator('.demo:not(.example)').getByRole('region', { name: 'Tags' })
  await expect(area).toHaveAttribute('tabindex', '0')
  expect(await area.evaluate((el) => getComputedStyle(el).scrollbarWidth)).toBe('thin')
  expect(await area.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true)
  await area.focus()
  await page.keyboard.press('PageDown')
  await expect.poll(() => area.evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
})

test('horizontal: it scrolls sideways, not down', async ({ page }) => {
  await page.goto('/components/scroll-area')
  const area = page.locator('[class*="scroll-area-horizontal-demo"] [data-part="scroll-area"]')
  expect(await area.evaluate((el) => [getComputedStyle(el).overflowX, getComputedStyle(el).overflowY])).toEqual([
    'auto',
    'hidden',
  ])
  expect(await area.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true)
})

for (const mode of modes) {
  test(`/components/scroll-area passes axe (${mode.label})`, async ({ browser }) => {
    const page = await pageIn(browser, mode)
    await page.goto('/components/scroll-area')
    expect(await axeViolations(page)).toEqual([])
  })
}
