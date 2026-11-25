// Typography: one stylesheet that styles plain HTML (Markdown's, a CMS's) inside data-part="prose". No JavaScript.
import { expect, test } from '@playwright/test'
import { axeViolations, modes, pageIn } from './helpers.ts'

const css = (l: import('@playwright/test').Locator, prop: string) =>
  l.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop)
const px = async (l: import('@playwright/test').Locator, prop: string) => parseFloat(await css(l, prop))

test('headings step down in size, text reads at a comfortable measure, and the parts get their look', async ({
  page,
}) => {
  await page.goto('/components/typography')
  const prose = page.locator('.demo:not(.example) [data-part="prose"]')
  const [h2, h3, h4, p] = await Promise.all(
    ['h2', 'h3', 'h4', 'p'].map((t) => px(prose.locator(t).first(), 'font-size')),
  )
  expect(h2).toBeGreaterThan(h3!)
  expect(h3).toBeGreaterThan(h4!)
  expect(h4).toBeGreaterThan(p!)
  expect(await px(prose, 'max-width')).toBeLessThan(800)
  expect(await css(prose.locator('blockquote'), 'border-left-style')).toBe('solid')
  expect(await css(prose.locator('ul').first(), 'list-style-type')).toBe('disc')
  expect(await css(prose.locator('ol').first(), 'list-style-type')).toBe('decimal')
  expect(await css(prose.locator('p code').first(), 'font-family')).toMatch(/mono/i)
  expect(await css(prose.locator('a').first(), 'text-decoration-line')).toBe('underline')
  expect(await css(prose.locator('td').first(), 'border-bottom-style')).toBe('solid')
})

test('spacing: the first child has no top margin, and blocks are spaced apart', async ({ page }) => {
  await page.goto('/components/typography')
  const prose = page.locator('.demo:not(.example) [data-part="prose"]')
  expect(await px(prose.locator('> :first-child'), 'margin-top')).toBe(0)
  expect(await px(prose.locator('> p').first(), 'margin-bottom')).toBeGreaterThan(0)
})

for (const mode of modes) {
  test(`/components/typography passes axe (${mode.label})`, async ({ browser }) => {
    const page = await pageIn(browser, mode)
    await page.goto('/components/typography')
    expect(await axeViolations(page)).toEqual([])
  })
}
