// Blocks: whole pages built from the components, shown at /blocks/<name> in a frame of /view/<name>.
import { expect, test } from '@playwright/test'
import { blocks } from '../src/registry.ts'
import { toCss } from '../src/theme/model.ts'
import { presets } from '../src/theme/presets.ts'
import { SCOPE, STORAGE_KEY } from '../src/theme/apply.ts'
import { axeViolations, modes, pageIn } from './helpers.ts'

test('the header links Components and Blocks, and its Theme button opens the theme sheet', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Main' })
  for (const [name, href] of [['Components', '/components'], ['Blocks', '/blocks']]) await expect(nav.getByRole('link', { name, exact: true })).toHaveAttribute('href', href!)
  await page.getByRole('button', { name: 'Theme', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Theme' })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Theme' }).getByRole('link', { name: /full preview/ })).toHaveAttribute('href', '/theme')
})

test('/blocks shows every block, full width, each linked to its page', async ({ page }) => {
  await page.goto('/blocks')
  await expect(page.locator('nav[aria-label="Sidebar"], .sidebar')).toHaveCount(0)
  for (const b of blocks) {
    await expect(page.locator(`main a[href="/blocks/${b.name}"]`).first()).toBeVisible()
    await expect(page.locator(`iframe[src="/view/${b.name}"]`)).toBeAttached()
  }
})

test('/blocks: search and categories narrow the list; nothing found says so', async ({ page }) => {
  await page.goto('/blocks')
  await page.locator('cl-island[c="block-filter"][data-cl-ready]').waitFor({ state: 'attached' })
  const row = (name: string) => page.locator(`[data-block="${name}"]`)
  for (const b of blocks) await expect(row(b.name)).toBeVisible()
  await page.getByRole('searchbox', { name: 'Search blocks' }).fill('cart')
  await expect(row('checkout')).toBeVisible()
  await expect(row('login')).toBeHidden()
  await page.getByRole('searchbox', { name: 'Search blocks' }).fill('')
  await page.getByRole('button', { name: 'Authentication' }).click()
  await expect(page.getByRole('button', { name: 'Authentication' })).toHaveAttribute('aria-pressed', 'true')
  await expect(row('login')).toBeVisible()
  await expect(row('checkout')).toBeHidden()
  await page.getByRole('button', { name: 'All' }).click()
  await expect(row('checkout')).toBeVisible()
  await page.getByRole('searchbox', { name: 'Search blocks' }).fill('zzqq')
  await expect(page.getByRole('status')).toHaveText('No blocks match "zzqq".')
  await expect(row('login')).toBeHidden()
})

test('/blocks: each row says its block, its line and its category, from the registry', async ({ page }) => {
  await page.goto('/blocks')
  for (const b of blocks) {
    const row = page.locator(`[data-block="${b.name}"]`)
    await expect(row.getByRole('link', { name: b.title, exact: true })).toHaveAttribute('href', `/blocks/${b.name}`)
    await expect(row).toContainText(b.description)
    await expect(row).toContainText(b.category!)
  }
})

test('the header search finds blocks', async ({ page }) => {
  await page.goto('/blocks')
  await page.locator('cl-island[c="search"][data-cl-ready]').waitFor({ state: 'attached' })
  await page.keyboard.press('Control+k')
  await page.getByRole('combobox', { name: 'Search the docs' }).fill('checkout')
  await expect(page.locator('#search-results a[href^="/blocks/checkout"]').first()).toBeVisible()
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

for (const name of ['login', 'checkout', 'dashboard']) {
  test(`/view/${name}: styled by theme.css (its tokens are set)`, async ({ page }) => {
    await page.goto(`/view/${name}`)
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ui-accent').trim())).not.toBe('')
    await expect(page.locator('[data-part="control"], [data-part="card"]').first()).not.toHaveCSS('border-top-width', '0px')
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
  test(`/blocks has no accessibility violations (${mode.label})`, async ({ browser }) => {
    const page = await pageIn(browser, mode)
    await page.goto('/blocks')
    await page.locator('cl-island[c="block-filter"][data-cl-ready]').waitFor({ state: 'attached' })
    expect(await axeViolations(page)).toEqual([])
  })
}

for (const mode of modes) for (const name of ['login', 'checkout', 'dashboard']) {
  test(`/blocks/${name} has no accessibility violations (${mode.label})`, async ({ browser }) => {
    const page = await pageIn(browser, mode)
    await page.goto(`/blocks/${name}`)
    await expect(page.frameLocator('iframe').locator('main')).toBeVisible()
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

  test('after a failed submit, typing the password key by key keeps every key and the focus', async ({ page }) => {
    await gotoLogin(page)
    await page.getByRole('button', { name: 'Sign in' }).click()
    const password = page.getByLabel('Password', { exact: true })
    await password.click()
    await password.pressSequentially('correct horse')
    await expect(password).toHaveValue('correct horse')
    await expect(password).toBeFocused()
    await page.getByLabel('Email').click()
    await page.getByLabel('Email').pressSequentially('ada@example.com')
    await expect(page.getByLabel('Email')).toHaveValue('ada@example.com')
    await expect(page.getByLabel('Email')).toBeFocused()
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

/** The checkout page, once its island has attached. */
async function gotoCheckout(page: import('@playwright/test').Page) {
  await page.goto('/view/checkout')
  await page.locator('cl-island[c="checkout-form"][data-cl-ready]').waitFor({ state: 'attached' })
}

test.describe('checkout block', () => {
  const next = (page: import('@playwright/test').Page) => page.getByRole('button', { name: /Continue to/ }).click()
  const fill = async (
    page: import('@playwright/test').Page,
    { card = '4242 4242 4242 4242', email = 'ada@example.com' } = {},
  ) => {
    await page.getByLabel('Email').fill(email)
    await next(page)
    await page.getByLabel('Full name').fill('Ada Lovelace')
    await page.getByLabel('Address').fill('12 St James Sq')
    await page.getByLabel('City').fill('London')
    await page.getByLabel('Postal code').fill('SW1Y 4JH')
    await page.getByLabel('Country').selectOption('GB')
    await next(page)
    await page.getByLabel('Card number').fill(card)
    await page.getByLabel('Expiry').fill('12/30')
    await page.getByLabel('CVC').fill('123')
  }
  const place = (page: import('@playwright/test').Page) => page.getByRole('button', { name: /Place order/ })

  test('/blocks/checkout: the frame, and Code lists its files and components', async ({ page }) => {
    await page.goto('/blocks/checkout')
    await expect(page.frameLocator('iframe[src="/view/checkout"]').locator('form')).toBeVisible()
    await page.getByRole('button', { name: 'Code', exact: true }).click()
    const tree = page.getByRole('navigation', { name: 'Files' })
    for (const f of ['checkout.tscl', 'checkout-form.tscl', 'data.ts', 'field.tscl', 'select.css', 'toast.css'])
      await expect(tree.getByRole('button', { name: f })).toBeVisible()
    await expect(page.locator('.needs')).toContainText('pnpm add zod')
  })

  test('typing key by key keeps every key and the focus', async ({ page }) => {
    await gotoCheckout(page)
    await page.getByLabel('Email').pressSequentially('ada@example.com')
    await expect(page.getByLabel('Email')).toHaveValue('ada@example.com')
    await expect(page.getByLabel('Email')).toBeFocused()
  })

  test('changing a quantity updates its line and the total', async ({ page }) => {
    await gotoCheckout(page)
    const total = page.getByTestId('checkout-total')
    await expect(total).toHaveText('$143.24')
    await page.getByLabel('Quantity of Canvas tote').fill('3')
    await expect(page.getByTestId('line-tote')).toContainText('$66.00')
    await expect(total).toHaveText('$167.00')
    await page.getByLabel('Quantity of Canvas tote').fill('-2')
    await expect(page.getByTestId('line-tote')).toContainText('$0.00')
  })

  test("an empty cart says so and can't be ordered", async ({ page }) => {
    await gotoCheckout(page)
    for (const name of ['Linen shirt', 'Canvas tote', 'Wool socks'])
      await page.getByRole('button', { name: `Remove ${name}` }).click()
    await expect(page.getByText('Your cart is empty.')).toBeVisible()
    await expect(page.getByTestId('checkout-total')).toHaveText('$0.00')
    await expect(page.getByRole('button', { name: /Continue to/ })).toBeDisabled()
  })

  test('three steps: Continue checks only this step, focusing its first error; Back keeps what was typed', async ({
    page,
  }) => {
    await gotoCheckout(page)
    const steps = page.getByRole('list', { name: 'Steps' })
    await expect(steps.locator('[aria-current="step"]')).toHaveText(/Contact/)
    await page.getByRole('button', { name: 'Continue to Shipping' }).click()
    await expect(page.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByLabel('Email')).toBeFocused()
    await page.getByLabel('Email').fill('ada@example.com')
    await page.getByRole('button', { name: 'Continue to Shipping' }).click()
    await expect(steps.locator('[aria-current="step"]')).toHaveText(/Shipping/)
    await expect(page.getByLabel('Full name')).toBeFocused()
    await expect(page.getByLabel('Full name')).not.toHaveAttribute('aria-invalid', 'true') // not shown before this step's Continue
    await page.getByRole('button', { name: 'Continue to Payment' }).click()
    await expect(page.getByLabel('Full name')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByLabel('Card number')).toBeHidden()
    await page.getByRole('button', { name: 'Back' }).click()
    await expect(page.getByLabel('Email')).toHaveValue('ada@example.com')
  })

  test('a declined card: a toast, the error on its field, focused; a good card places the order', async ({ page }) => {
    await gotoCheckout(page)
    await fill(page, { card: '4000 0000 0000 0002' })
    await place(page).click()
    await expect(page.locator('[data-part="toast"][data-type="error"]')).toContainText('Your card was declined.')
    await expect(page.locator('[data-part="field"]').getByText('Your card was declined.')).toBeVisible()
    await expect(page.getByLabel('Card number')).toBeFocused()
    await page.getByLabel('Card number').fill('4242 4242 4242 4242')
    await expect(page.locator('[data-part="field"]').getByText('Your card was declined.')).toBeHidden()
    await place(page).click()
    await expect(page.locator('[data-part="toast"][data-type="success"]')).toContainText(/Order placed: ord_\w+/)
  })

  test('a failed call says so in a toast, and the order can be sent again', async ({ page }) => {
    await gotoCheckout(page)
    await fill(page, { email: 'offline@example.com' })
    await place(page).click()
    await expect(page.locator('[data-part="toast"][data-type="error"]')).toContainText("Couldn't place the order")
    await expect(place(page)).toBeEnabled()
  })

  test('at phone width the summary comes first and nothing scrolls sideways', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 })
    await gotoCheckout(page)
    const summary = await page.getByRole('region', { name: 'Order summary' }).boundingBox()
    const form = await page.locator('form').boundingBox()
    expect(summary!.y).toBeLessThan(form!.y)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  })
})

/** The dashboard page, once its table and chart have attached. */
async function gotoDashboard(page: import('@playwright/test').Page) {
  await page.goto('/view/dashboard')
  await page.locator('cl-island[c="dashboard-table"][data-cl-ready]').waitFor({ state: 'attached' })
  await page.locator('cl-island[c="chart-interactive"][data-cl-ready]').waitFor({ state: 'attached' })
}

test.describe('dashboard block', () => {
  const table = (page: import('@playwright/test').Page) => page.getByRole('region', { name: 'Sections' })
  const bodyRows = (page: import('@playwright/test').Page) => table(page).locator('tbody tr')

  test('/blocks/dashboard: the frame, and Code lists its files and components', async ({ page }) => {
    await page.goto('/blocks/dashboard')
    await expect(page.frameLocator('iframe[src="/view/dashboard"]').locator('main')).toBeVisible()
    await page.getByRole('button', { name: 'Code', exact: true }).click()
    const tree = page.getByRole('navigation', { name: 'Files' })
    for (const f of ['dashboard.tscl', 'dashboard-table.tscl', 'stat-card.tscl', 'data.ts', 'chart.tscl', 'chart-geometry.ts', 'chart-interactive.tscl', 'sidebar.css']) await expect(tree.getByRole('button', { name: f.includes('/') ? f : new RegExp(`(^|/)${f.replace('.', '\\.')}$`) })).toBeVisible()
  })

  test('four stat cards and the chart; its range switch changes the points', async ({ page }) => {
    await gotoDashboard(page)
    await expect(page.locator('[data-part="card"]').filter({ hasText: 'Total revenue' })).toBeVisible()
    await expect(page.locator('.dash-stats [data-part="card"]')).toHaveCount(4)
    // Never three and one: the rows hold 4, 2 or 1 cards.
    for (const width of [1280, 1180, 900, 390]) {
      await page.setViewportSize({ width, height: 900 })
      const tops = await page.locator('.dash-stats [data-part="card"]').evaluateAll((cards) => cards.map((c) => Math.round(c.getBoundingClientRect().top)))
      const perRow = [...new Set(tops)].map((t) => tops.filter((x) => x === t).length)
      expect(perRow.every((n) => n === perRow[0]), `${width}: ${perRow}`).toBe(true)
    }
    const points = () => page.locator('[data-part="chart-line"]').first().evaluate((p) => (p.getAttribute('d')!.match(/[ML]/g) ?? []).length)
    expect(await points()).toBe(90)
    await page.getByRole('button', { name: 'Last 7 days' }).click()
    await expect.poll(points).toBe(7)
  })

  test('the sidebar collapses on a desktop, and opens as a panel on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await gotoDashboard(page)
    const nav = page.locator('#dash-nav')
    await expect(nav).toBeVisible()
    await page.getByRole('button', { name: 'Toggle sidebar' }).click()
    await expect(nav).toHaveAttribute('data-state', 'collapsed')
    await page.setViewportSize({ width: 390, height: 800 })
    await page.reload()
    await page.locator('cl-island[c="dashboard-table"][data-cl-ready]').waitFor({ state: 'attached' })
    await page.getByRole('button', { name: 'Toggle sidebar' }).click()
    await expect(nav).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  })

  test('a column header sorts the rows both ways (aria-sort), and keeps the focus', async ({ page }) => {
    await gotoDashboard(page)
    const target = table(page).getByRole('button', { name: 'Target' })
    const th = table(page).locator('th', { has: page.getByRole('button', { name: 'Target' }) })
    await target.click()
    await expect(th).toHaveAttribute('aria-sort', 'ascending')
    const values = () => bodyRows(page).locator('td[data-col="target"]').allTextContents().then((t) => t.map(Number))
    let v = await values()
    expect(v).toEqual([...v].sort((a, b) => a - b))
    await page.keyboard.press('Enter')
    await expect(th).toHaveAttribute('aria-sort', 'descending')
    await expect(target).toBeFocused()
    v = await values()
    expect(v).toEqual([...v].sort((a, b) => b - a))
  })

  test('pages of 10: Next shows rows 11 to 20', async ({ page }) => {
    await gotoDashboard(page)
    await expect(bodyRows(page)).toHaveCount(10)
    const first = await bodyRows(page).first().textContent()
    await page.getByRole('button', { name: 'Next page' }).click()
    await expect(page.getByText('Page 2 of 3')).toBeVisible()
    await expect(bodyRows(page)).toHaveCount(10)
    await expect(bodyRows(page).first()).not.toHaveText(first!)
  })

  test('the status switch and the search narrow the rows; none found says so', async ({ page }) => {
    await gotoDashboard(page)
    await page.getByRole('button', { name: /^In progress \d+$/ }).click()
    for (const s of await bodyRows(page).locator('td[data-col="status"]').allTextContents()) expect(s.trim()).toBe('In progress')
    await page.getByRole('searchbox', { name: 'Search sections' }).fill('zzqq')
    await expect(table(page)).toContainText('No sections match.')
  })

  test('at phone width the page doesn\'t scroll sideways; the table scrolls in its own region', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 })
    await gotoDashboard(page)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  })
})

test('/theme: a full-width tool page, no docs sidebar', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/theme')
  await expect(page.locator('nav[aria-label="Sidebar"], .sidebar')).toHaveCount(0)
  const preview = await page.locator('[data-ui-preview]').first().boundingBox()
  expect(preview!.x).toBeGreaterThanOrEqual(16)
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
