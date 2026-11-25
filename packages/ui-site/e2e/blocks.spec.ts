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

test('/blocks shows every block, full width, each linked to its page', async ({ page }) => {
  await page.goto('/blocks')
  await expect(page.locator('nav[aria-label="Sidebar"], .sidebar')).toHaveCount(0)
  for (const b of blocks) {
    await expect(page.locator(`main a[href="/blocks/${b.name}"]`).first()).toBeVisible()
    await expect(page.locator(`iframe[src="/view/${b.name}"]`)).toBeAttached()
  }
})

test('/blocks/login: a full-width page, no docs sidebar; the frame at desktop, tablet and phone widths', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.goto('/blocks/login')
  await expect(page.locator('nav[aria-label="Sidebar"], .sidebar')).toHaveCount(0)
  const frame = page.locator('iframe[src="/view/login"]')
  await expect(frame).toHaveAttribute('title', 'Login preview')
  expect((await frame.boundingBox())!.width).toBeGreaterThan(1100)
  await expect(page.frameLocator('iframe[src="/view/login"]').locator('form')).toBeVisible()
  const width = () => frame.evaluate((f) => f.getBoundingClientRect().width)
  const full = await width()
  await page.getByRole('button', { name: 'Phone width' }).click()
  await expect(page.getByRole('button', { name: 'Phone width' })).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(width).toBe(390)
  await page.getByRole('button', { name: 'Tablet width' }).click()
  await expect.poll(width).toBe(768)
  await page.getByRole('button', { name: 'Desktop width' }).click()
  await expect(page.getByRole('button', { name: 'Phone width' })).toHaveAttribute('aria-pressed', 'false')
  await expect.poll(width).toBe(full)
  const open = page.getByRole('link', { name: 'Open in new tab' })
  await expect(open).toHaveAttribute('href', '/view/login')
  await expect(open).toHaveAttribute('target', '_blank')
})

test('/blocks/login: Code shows a tree of every file to copy, the block\'s and its components\', one at a time', async ({ page }) => {
  await page.goto('/blocks/login')
  await page.getByRole('button', { name: 'Code', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Code', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('iframe[src="/view/login"]')).toBeHidden()
  const tree = page.getByRole('navigation', { name: 'Files' })
  for (const f of ['login.tscl', 'data.ts', 'card.tscl', 'field.tscl', 'button.tscl']) await expect(tree.getByRole('button', { name: f })).toBeVisible()
  await expect(page.locator('.code-block:visible')).toHaveCount(1)
  await expect(page.locator('.code-block:visible')).toContainText('<uiCard>')
  await tree.getByRole('button', { name: 'data.ts' }).click()
  await expect(page.locator('.code-block:visible')).toHaveCount(1)
  await expect(page.locator('.code-block:visible')).toContainText('export function validateLogin')
  await expect(tree.getByRole('button', { name: 'data.ts' })).toHaveAttribute('aria-current', 'true')
  await page.getByRole('button', { name: 'Preview', exact: true }).click()
  await expect(page.locator('iframe[src="/view/login"]')).toBeVisible()
})

test('/blocks/login: the toolbar stays under the header while the page scrolls', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 600 })
  await page.goto('/blocks/login')
  await page.mouse.move(640, 400)
  await page.mouse.wheel(0, 500)
  await expect.poll(async () => (await page.getByRole('toolbar', { name: 'Login' }).boundingBox())!.y).toBeLessThan(120)
})

test('/blocks/login: the frame follows the header\'s light/dark switch at once', async ({ page }) => {
  await page.goto('/blocks/login')
  const scheme = () => page.frameLocator('iframe[src="/view/login"]').locator('html').getAttribute('data-theme')
  const toggle = page.locator('.theme-toggle')
  for (let i = 0; i < 3 && (await page.locator('html').getAttribute('data-theme')) !== 'dark'; i++) await toggle.click()
  await expect.poll(scheme).toBe('dark')
  for (let i = 0; i < 3 && (await page.locator('html').getAttribute('data-theme')) !== 'light'; i++) await toggle.click()
  await expect.poll(scheme).toBe('light')
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

/** The login page, once its island has attached (a click before that submits the form natively). */
async function gotoLogin(page: import('@playwright/test').Page) {
  await page.goto('/view/login')
  await page.locator('cl-island[c="login-form"][data-cl-ready]').waitFor({ state: 'attached' })
}

test.describe('login block', () => {
  test('typing key by key keeps every key and the focus (fields aren\'t rebuilt while typed in)', async ({ page }) => {
    await gotoLogin(page)
    await page.getByLabel('Email').pressSequentially('ada@example.com')
    await expect(page.getByLabel('Email')).toHaveValue('ada@example.com')
    await expect(page.getByLabel('Email')).toBeFocused()
    await page.getByLabel('Password', { exact: true }).pressSequentially('correct horse')
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue('correct horse')
  })

  test('an empty submit shows an error on each field and focuses the first', async ({ page }) => {
    await gotoLogin(page)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByText('Enter your email address.')).toBeVisible()
    await expect(page.getByText('Use at least 8 characters.')).toBeVisible()
    await expect(page.getByLabel('Email')).toBeFocused()
  })

  test('valid details sign in: the button waits, then a status says who', async ({ page }) => {
    await page.clock.install() // the stub waits 300ms: time moves only when the test says
    await gotoLogin(page)
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000)
    await page.getByLabel('Email').fill('ada@example.com')
    await page.getByLabel('Password', { exact: true }).fill('correct horse')
    await page.getByRole('button', { name: 'Sign in' }).click()
    const button = page.getByRole('button', { name: 'Signing in…' })
    await expect(button).toBeDisabled()
    await page.clock.runFor(400)
    await expect(page.locator('[data-part="toast"][data-type="success"]')).toContainText('Signed in as ada@example.com.')
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled()
  })

  test('an error from the handler lands on its field', async ({ page }) => {
    await gotoLogin(page)
    await page.getByLabel('Email').fill('taken@example.com')
    await page.getByLabel('Password', { exact: true }).fill('12345678')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.locator('[data-part="field"]').getByText('Wrong email or password.')).toBeVisible()
    await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('aria-invalid', 'true')
    await expect(page.locator('[data-part="toast"][data-type="error"]')).toContainText('Wrong email or password.')
  })

  test('an error from signIn is focused; changing what was rejected lets this page\'s own rules speak again', async ({ page }) => {
    await gotoLogin(page)
    await page.getByLabel('Email').fill('taken@example.com')
    await page.getByLabel('Password', { exact: true }).fill('12345678')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.locator('[data-part="field"]').getByText('Wrong email or password.')).toBeVisible()
    await expect(page.getByLabel('Password', { exact: true })).toBeFocused()
    await page.getByLabel('Password', { exact: true }).fill('x')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByText('Use at least 8 characters.')).toBeVisible()
    await expect(page.locator('[data-part="field"]').getByText('Wrong email or password.')).toBeHidden()
  })

  test('a failed call shows an alert, and the form can be sent again', async ({ page }) => {
    await gotoLogin(page)
    await page.getByLabel('Email').fill('offline@example.com')
    await page.getByLabel('Password', { exact: true }).fill('12345678')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.locator('[data-part="toast"][data-type="error"]')).toContainText("Couldn't sign in")
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled()
  })

  test('at phone width nothing scrolls sideways', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 })
    await gotoLogin(page)
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

test('/blocks/login: Copy page says so when the clipboard refuses', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new DOMException('denied', 'NotAllowedError')) } }) })
  await page.goto('/blocks/login')
  await page.getByRole('button', { name: 'Copy page' }).click()
  await expect(page.getByRole('alert')).toContainText("Couldn't copy")
  await expect(page.getByRole('button', { name: 'Copied' })).toHaveCount(0)
})

test('the header\'s light/dark switch shows what another tab chose', async ({ context }) => {
  const one = await context.newPage()
  const two = await context.newPage()
  await one.goto('/')
  await two.goto('/')
  const toggle = (p: import('@playwright/test').Page) => p.locator('.theme-toggle').first()
  for (let i = 0; i < 3 && (await one.locator('html').getAttribute('data-theme')) !== 'dark'; i++) await toggle(one).click()
  await expect(two.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(toggle(two)).toHaveAttribute('aria-label', 'Theme: dark (change)')
})
