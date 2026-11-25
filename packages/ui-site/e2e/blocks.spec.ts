// Blocks: whole pages built from the components, shown at /blocks/<name> in a frame of /view/<name>.
import { expect, test } from '@playwright/test'
import { blocks } from '../src/registry.ts'
import { toCss } from '../src/theme/model.ts'
import { presets } from '../src/theme/presets.ts'
import { SCOPE, STORAGE_KEY } from '../src/theme/apply.ts'
import { axeViolations, modes, pageIn } from './helpers.ts'

test('the header links Components, Blocks and Theme on a desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Main' })
  for (const [name, href] of [['Components', '/'], ['Blocks', '/blocks'], ['Theme', '/theme']]) await expect(nav.getByRole('link', { name, exact: true })).toHaveAttribute('href', href!)
})

test('/blocks lists every block, linked', async ({ page }) => {
  await page.goto('/blocks')
  for (const b of blocks) await expect(page.locator(`main a[href="/blocks/${b.name}"]`).first()).toBeVisible()
})

test('/blocks/login: the frame shows /view/login at desktop, tablet and phone widths', async ({ page }) => {
  await page.goto('/blocks/login')
  const frame = page.locator('iframe[src="/view/login"]')
  await expect(frame).toHaveAttribute('title', 'Login preview')
  await expect(page.frameLocator('iframe[src="/view/login"]').locator('form')).toBeVisible()
  const width = () => frame.evaluate((f) => f.getBoundingClientRect().width)
  const full = await width()
  await page.getByRole('button', { name: 'Phone' }).click()
  await expect(page.getByRole('button', { name: 'Phone' })).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(width).toBe(390)
  await page.getByRole('button', { name: 'Tablet' }).click()
  await expect.poll(width).toBe(Math.min(768, full))
  await page.getByRole('button', { name: 'Desktop' }).click()
  await expect(page.getByRole('button', { name: 'Phone' })).toHaveAttribute('aria-pressed', 'false')
  await expect.poll(width).toBe(full)
  const open = page.getByRole('link', { name: 'Open in new tab' })
  await expect(open).toHaveAttribute('href', '/view/login')
  await expect(open).toHaveAttribute('target', '_blank')
})

test('/view/login: the block alone, no site chrome, kept out of search, the sitemap and llms.txt', async ({ page, request }) => {
  await page.goto('/view/login')
  await expect(page.locator('form')).toBeVisible()
  await expect(page.locator('header, nav[aria-label="Sidebar"], aside')).toHaveCount(0)
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex')
  expect(await (await request.get('/sitemap.xml')).text()).not.toContain('/view/')
  expect(await (await request.get('/llms.txt')).text()).not.toContain('/view/')
})

test('/view/login: a theme saved on /theme applies to the block', async ({ page }) => {
  const red = toCss({ light: { ...presets.teal.light, accent: '#ff0000' }, dark: { ...presets.teal.dark, accent: '#ff0000' } }, SCOPE)
  await page.addInitScript(([key, css]) => localStorage.setItem(key, css), [STORAGE_KEY, red] as const)
  await page.goto('/view/login')
  await expect(page.locator('[data-ui-preview] [data-part="button"][data-variant="default"]').first()).toHaveCSS('background-color', 'rgb(255, 0, 0)')
})

for (const mode of modes) {
  test(`/blocks/login has no accessibility violations (${mode.label})`, async ({ browser }) => {
    const page = await pageIn(browser, mode)
    await page.goto('/blocks/login')
    await expect(page.frameLocator('iframe').locator('form')).toBeVisible()
    expect(await axeViolations(page)).toEqual([])
  })
}
