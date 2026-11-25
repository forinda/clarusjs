import { expect, test } from '@playwright/test'
import { axeViolations, modes, pageIn } from './helpers.ts'

test('/theme: renders the preview; its menu and dialog work', async ({ page }) => {
  expect((await page.goto('/theme'))?.status()).toBe(200)
  await expect(page.locator('h1')).toHaveText('Theme')
  const preview = page.locator('[data-ui-preview]')
  await expect(preview).toBeVisible()
  await preview.locator('cl-island[data-cl-ready]').first().waitFor()
  await preview.getByRole('button', { name: 'Actions' }).click()
  await expect(page.getByRole('menuitem', { name: 'Archive' })).toBeFocused()
  await page.keyboard.press('Escape')
  await preview.getByRole('button', { name: 'Invite people' }).click()
  await expect(page.getByRole('dialog', { name: 'Invite people' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Invite people' })).toBeHidden()
})

for (const mode of modes) {
  test(`/theme: passes axe and fits the screen (${mode.label})`, async ({ browser }) => {
    const page = await pageIn(browser, mode)
    await page.goto('/theme')
    expect(await axeViolations(page)).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.context().close()
  })
}

const previewButton = '[data-ui-preview] [data-part="button"][data-variant="default"]'
/** The builder: in the sheet the header's Theme button opens, on every page. */
async function openSheet(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Theme', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Theme' })).toBeVisible()
  await page.locator('.theme-builder[data-ready]').waitFor()
}
async function openBuilder(page: import('@playwright/test').Page) {
  await page.goto('/theme')
  await openSheet(page)
  await openColours(page)
}
/** The per-colour editor: a section of the panel, closed until opened. */
async function openColours(page: import('@playwright/test').Page) {
  const colours = page.locator('.theme-builder details.tb-colours')
  if (!(await colours.evaluate((d: HTMLDetailsElement) => d.open))) await colours.locator('summary').click()
}
/** Presets are in a list the Preset row opens. */
async function pickPreset(page: import('@playwright/test').Page, name: string) {
  await page.getByRole('button', { name: /^Preset/ }).click()
  await page.getByRole('button', { name: `${name} preset` }).click()
}
/** Light or dark comes from the header's switch (system → light → dark); the builder edits the set it shows. */
async function scheme(page: import('@playwright/test').Page, want: 'light' | 'dark') {
  // The sheet is modal (the header behind it is inert): close it, switch, open it again.
  if (await page.getByRole('dialog', { name: 'Theme' }).isVisible()) await page.keyboard.press('Escape')
  for (let i = 0; i < 3 && (await page.locator('html').getAttribute('data-theme')) !== want; i++) await page.locator('.theme-toggle').first().click()
  await openSheet(page)
  await expect(page.locator('.theme-builder')).toHaveAttribute('data-mode', want)
}
const token = (page: import('@playwright/test').Page, name: string) => page.locator('[data-ui-preview]').evaluate((el, n) => getComputedStyle(el).getPropertyValue(`--ui-${n}`).trim(), name)

test('theme builder: picking the indigo preset changes the preview\'s accent', async ({ page }) => {
  await openBuilder(page)
  await pickPreset(page, 'Indigo')
  await expect(page.locator(previewButton).first()).toHaveCSS('background-color', 'rgb(79, 70, 229)')
})

test('theme builder: editing Brand › accent updates the preview at once', async ({ page }) => {
  await openBuilder(page)
  await page.getByLabel('Accent', { exact: true }).fill('#123456')
  await expect(page.locator(previewButton).first()).toHaveCSS('background-color', 'rgb(18, 52, 86)')
})

test('theme builder: the dark toggle edits and shows the dark set; light stays', async ({ page }) => {
  await openBuilder(page)
  await scheme(page, 'dark')
  expect(await token(page, 'bg')).toBe('#121a1b')
  await page.getByLabel('Accent', { exact: true }).fill('#abcdef')
  await expect(page.locator(previewButton).first()).toHaveCSS('background-color', 'rgb(171, 205, 239)')
  await scheme(page, 'light')
  expect(await token(page, 'accent')).toBe('#0b6e70')
})

test('theme builder: editing a light colour fills its dark value, unless dark was edited', async ({ page }) => {
  await openBuilder(page)
  await page.getByLabel('Background', { exact: true }).fill('#fff8e7')
  await scheme(page, 'dark')
  const generated = await token(page, 'bg')
  expect(generated).not.toBe('#121a1b')
  await page.getByLabel('Background', { exact: true }).fill('#000000')
  await scheme(page, 'light')
  await page.getByLabel('Background', { exact: true }).fill('#ffffff')
  await scheme(page, 'dark')
  expect(await token(page, 'bg')).toBe('#000000')
})

test('theme builder: radius, shadow and heading font', async ({ page }) => {
  await openBuilder(page)
  await page.getByLabel('Radius').evaluate((el: HTMLInputElement) => { el.value = '16'; el.dispatchEvent(new Event('input', { bubbles: true })) })
  expect(await token(page, 'radius')).toBe('16px')
  await page.getByLabel('Shadow').selectOption('none')
  expect(await token(page, 'shadow')).toBe('none')
  await page.getByLabel('Heading font').selectOption({ label: 'Lora' })
  expect(await token(page, 'font-heading')).toContain('Lora')
})

test('theme builder: Copy CSS puts the theme on the clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await openBuilder(page)
  await page.getByLabel('Accent', { exact: true }).fill('#123456')
  await page.getByRole('button', { name: 'Copy CSS' }).click()
  const text = await page.evaluate(() => navigator.clipboard.readText())
  expect(text).toContain('--ui-accent: #123456;')
  expect(text).toContain(":root[data-theme='dark'] {")
})

test('theme builder: Shuffle changes the accent; Reset returns to the preset', async ({ page }) => {
  await openBuilder(page)
  await page.getByRole('button', { name: 'Shuffle' }).click()
  expect(await token(page, 'accent')).not.toBe('#0b6e70')
  await page.getByRole('button', { name: 'Reset', exact: true }).click()
  expect(await token(page, 'accent')).toBe('#0b6e70')
})

test('theme builder: an edit restyles the page it is made on at once, and is saved for the others', async ({ page }) => {
  await page.goto('/components/button')
  await openSheet(page)
  await openColours(page)
  await page.getByLabel('Accent', { exact: true }).fill('#123456')
  const demo = page.locator('.demo [data-part="button"][data-variant="default"]').first()
  await expect(demo).toHaveCSS('background-color', 'rgb(18, 52, 86)')
  await page.goto('/components/input')
  await page.goto('/components/button')
  await expect(demo).toHaveCSS('background-color', 'rgb(18, 52, 86)')
})

test('theme builder: an edit restyles the block frames on the page too', async ({ page }) => {
  await page.goto('/blocks/login')
  const button = page.frameLocator('iframe[src="/view/login"]').locator('[data-part="button"][data-variant="default"]').first()
  await expect(button).toBeVisible()
  await openSheet(page)
  await page.getByLabel('Brand', { exact: true }).fill('#123456')
  await expect(button).toHaveCSS('background-color', 'rgb(18, 52, 86)')
})

test('theme builder: Share copies a /theme?t= link that opens the same theme without saving it', async ({ page, context, browser }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await openBuilder(page)
  await pickPreset(page, 'Indigo')
  await page.getByLabel('Accent', { exact: true }).fill('#123456')
  await page.getByRole('button', { name: 'Share link' }).click()
  const link = await page.evaluate(() => navigator.clipboard.readText())
  expect(link).toMatch(/\/theme\?t=indigo/)
  const fresh = await (await browser.newContext()).newPage()
  await fresh.goto(new URL(link).pathname + new URL(link).search)
  await openSheet(fresh)
  expect(await token(fresh, 'accent')).toBe('#123456')
  expect(await fresh.evaluate(() => localStorage.getItem('ui-theme'))).toBeNull()
  await fresh.context().close()
})

test('theme builder: a malformed t= opens the default preset with no error', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/theme?t=%7Bbad')
  await openSheet(page)
  expect(await token(page, 'accent')).toBe('#0b6e70')
  expect(errors).toEqual([])
})

test('theme builder: a failing pair shows a warning next to its control, in the mode being edited', async ({ page }) => {
  await openBuilder(page)
  const warning = page.locator('#tb-accent-fg-warn')
  await expect(warning).toBeHidden()
  await page.getByLabel('Accent text', { exact: true }).fill('#0b6e70')
  await expect(warning).toBeVisible()
  await expect(warning).toContainText('Low contrast')
  await page.getByLabel('Accent text', { exact: true }).fill('#ffffff')
  await expect(warning).toBeHidden()
  await scheme(page, 'dark')
  await page.getByLabel('Accent text', { exact: true }).fill('#4cc9cb')
  await expect(warning).toBeVisible()
})

test('theme builder: on a phone the sheet rises from the bottom; Escape closes it and focus returns; no sideways scroll', async ({ browser }) => {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 800 } })).newPage()
  await page.goto('/components/button')
  const open = page.getByRole('button', { name: 'Theme', exact: true })
  expect((await open.boundingBox())!.width).toBeLessThan(44) // the icon alone; the name stays
  expect((await page.locator('.theme-toggle').first().boundingBox())!.x + 30).toBeLessThan(390)
  await openSheet(page)
  const sheet = (await page.getByRole('dialog', { name: 'Theme' }).boundingBox())!
  expect(sheet.y + sheet.height).toBeGreaterThan(799)
  expect(sheet.y).toBeGreaterThan(80)
  expect(sheet.width).toBeGreaterThan(389)
  await expect(page.getByLabel('Brand', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(await axeViolations(page)).toEqual([])
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Theme' })).toBeHidden()
  await expect(open).toBeFocused()
  await page.context().close()
})

test('#review: a shared link with a font, a shadow and a dark override restores all three', async ({ page }) => {
  await page.goto("/theme?t=teal~l!font!'Lora'%2C%20Georgia%2C%20serif~l!shadow!none~d!shadow!none~d!accent!%23abcdef")
  await openSheet(page)
  await openColours(page)
  await expect(page.locator('head link[href*="fonts.googleapis.com"][href*="Lora"]')).toHaveCount(1)
  await expect(page.getByLabel('Shadow')).toHaveValue('none')
  await page.getByLabel('Accent', { exact: true }).fill('#123456')
  await scheme(page, 'dark')
  expect(await token(page, 'accent')).toBe('#abcdef')
})

test('#review: the contrast warning describes its colour input', async ({ page }) => {
  await openBuilder(page)
  const input = page.getByLabel('Accent text', { exact: true })
  await expect(input).not.toHaveAttribute('aria-describedby')
  await input.fill('#0b6e70')
  await expect(input).toHaveAttribute('aria-describedby', 'tb-accent-fg-warn')
})

test('theme builder: density changes the spacing unit, and every step of the scale follows in the preview', async ({ page }) => {
  await page.goto('/theme')
  // A step of the scale, measured inside the preview: 4 × the unit.
  const step4 = () => page.locator('[data-ui-preview]').first().evaluate((el) => {
    const probe = el.appendChild(document.createElement('div'))
    probe.style.padding = 'var(--ui-space-4)'
    const value = getComputedStyle(probe).paddingTop
    probe.remove()
    return value
  })
  expect(await step4()).toBe('16px')
  await openSheet(page)
  await page.getByLabel('Density').selectOption('Comfortable')
  expect(await token(page, 'space')).toBe('5px')
  await expect.poll(step4).toBe('20px')
})

test('theme builder: on a desktop a sheet at the right edge, of slim rows; /theme is all preview; no light/dark buttons of its own', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/theme')
  await expect(page.locator('.theme-builder')).toHaveCount(1) // one builder: the sheet's
  const preview = (await page.locator('[data-ui-preview]').first().boundingBox())!
  expect(preview.width).toBeGreaterThan(1100)
  await page.getByRole('button', { name: 'Customize' }).click() // the page's own button opens the same sheet
  await expect(page.getByRole('dialog', { name: 'Theme' })).toBeVisible()
  await page.locator('.theme-builder[data-ready]').waitFor()
  const sheet = (await page.getByRole('dialog', { name: 'Theme' }).boundingBox())!
  expect(sheet.x + sheet.width).toBeGreaterThan(1439)
  expect(sheet.width).toBeLessThanOrEqual(400)
  await expect(page.locator('.theme-builder details.tb-colours')).not.toHaveAttribute('open')
  await expect(page.getByRole('button', { name: /^Preset Teal/ })).toBeVisible()
  for (const label of ['Brand', 'Heading font', 'Body font', 'Radius', 'Density', 'Shadow']) await expect(page.getByLabel(label, { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Light', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Dark', exact: true })).toHaveCount(0)
})

test('theme builder: Brand sets the accent in the set the header shows', async ({ page }) => {
  await page.goto('/theme')
  await openSheet(page)
  await scheme(page, 'light')
  await page.getByLabel('Brand', { exact: true }).fill('#123456')
  expect(await token(page, 'accent')).toBe('#123456')
  await scheme(page, 'dark')
  expect(await token(page, 'accent')).not.toBe('#123456')
})

test('theme builder: Preset opens a list of named presets', async ({ page }) => {
  await page.goto('/theme')
  await openSheet(page)
  await pickPreset(page, 'Indigo')
  await expect(page.getByRole('button', { name: /^Preset/ })).toContainText('Indigo')
  await expect(page.getByRole('button', { name: 'Indigo preset' })).toBeHidden() // the list closes
})

test('theme builder: its controls are this library\'s parts (Select, Slider, Popover, Button); colours stay native, in a <details>', async ({ page }) => {
  await page.goto('/components/button')
  await openSheet(page)
  const b = page.locator('.theme-builder')
  for (const label of ['Heading font', 'Body font', 'Code font', 'Base size', 'Density', 'Shadow']) {
    await expect(b.locator('[data-part="select"]').filter({ has: page.getByLabel(label, { exact: true }) })).toHaveCount(1)
  }
  await expect(b.locator('[data-part="slider"]')).toHaveAttribute('aria-label', 'Radius')
  await expect(b.locator('[data-part="popover"]#tb-presets')).toHaveCount(1)
  await expect(b.locator('details.tb-colours input[type="color"]').first()).toBeAttached()
  for (const name of ['Copy CSS', 'Shuffle', 'Share link', 'Reset']) await expect(b.getByRole('button', { name, exact: true })).toHaveAttribute('data-part', 'button')
})
