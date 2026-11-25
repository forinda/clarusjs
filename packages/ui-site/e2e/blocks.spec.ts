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
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0)
  await expect(page.locator('.sidebar, [data-pagefind-body]')).toHaveCount(0)
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex')
  expect(await (await request.get('/sitemap.xml')).text()).not.toContain('/view/')
  expect(await (await request.get('/llms.txt')).text()).not.toContain('/view/')
})

for (const name of ['login']) {
  test(`/view/${name}: styled by theme.css (its tokens are set)`, async ({ page }) => {
    await page.goto(`/view/${name}`)
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ui-accent').trim())).not.toBe('')
    await expect(page.locator('[data-part="control"]').first()).not.toHaveCSS('border-top-width', '0px')
    expect(await page.evaluate(() => getComputedStyle(document.body).margin)).toBe('0px')
  })
}

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

test.describe('login block', () => {
  test('an empty submit shows an error on each field and focuses the first', async ({ page }) => {
    await page.goto('/view/login')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByText('Enter your email address.')).toBeVisible()
    await expect(page.getByText('Use at least 8 characters.')).toBeVisible()
    await expect(page.getByLabel('Email')).toBeFocused()
  })

  test('valid details sign in: the button waits, then a status says who', async ({ page }) => {
    await page.clock.install() // the stub waits 300ms: time moves only when the test says
    await page.goto('/view/login')
    await page.getByLabel('Email').fill('ada@example.com')
    await page.getByLabel('Password', { exact: true }).fill('correct horse')
    await page.getByRole('button', { name: 'Sign in' }).click()
    const button = page.getByRole('button', { name: 'Signing in…' })
    await expect(button).toBeDisabled()
    await page.clock.runFor(400)
    await expect(page.getByRole('status')).toHaveText('Signed in as ada@example.com.')
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled()
  })

  test('an error from the handler lands on its field', async ({ page }) => {
    await page.goto('/view/login')
    await page.getByLabel('Email').fill('taken@example.com')
    await page.getByLabel('Password', { exact: true }).fill('12345678')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByText('Wrong email or password.')).toBeVisible()
    await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('aria-invalid', 'true')
  })

  test('a failed call shows an alert, and the form can be sent again', async ({ page }) => {
    await page.goto('/view/login')
    await page.getByLabel('Email').fill('offline@example.com')
    await page.getByLabel('Password', { exact: true }).fill('12345678')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('alert').filter({ hasText: "Couldn't sign in" })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled()
  })

  test('at phone width nothing scrolls sideways', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 })
    await page.goto('/view/login')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  })
})

test('/theme: a full-width tool page, the builder beside its preview on a desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/theme')
  await expect(page.locator('nav[aria-label="Sidebar"], .sidebar')).toHaveCount(0)
  const panel = await page.locator('.theme-builder').boundingBox()
  const preview = await page.locator('[data-ui-preview]').first().boundingBox()
  expect(preview!.x).toBeGreaterThan(panel!.x + panel!.width - 1)
  expect(panel!.x).toBeGreaterThanOrEqual(16)
})
