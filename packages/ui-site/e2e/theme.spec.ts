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
async function openBuilder(page: import('@playwright/test').Page) {
  await page.goto('/theme')
  await page.locator('.theme-builder[data-ready]').waitFor()
}
const token = (page: import('@playwright/test').Page, name: string) => page.locator('[data-ui-preview]').evaluate((el, n) => getComputedStyle(el).getPropertyValue(`--ui-${n}`).trim(), name)

test('theme builder: picking the indigo preset changes the preview\'s accent', async ({ page }) => {
  await openBuilder(page)
  await page.getByRole('button', { name: 'Indigo preset' }).click()
  await expect(page.locator(previewButton).first()).toHaveCSS('background-color', 'rgb(79, 70, 229)')
})

test('theme builder: editing Brand › accent updates the preview at once', async ({ page }) => {
  await openBuilder(page)
  await page.getByLabel('Accent', { exact: true }).fill('#123456')
  await expect(page.locator(previewButton).first()).toHaveCSS('background-color', 'rgb(18, 52, 86)')
})

test('theme builder: the dark toggle edits and shows the dark set; light stays', async ({ page }) => {
  await openBuilder(page)
  await page.getByRole('button', { name: 'Dark' }).click()
  expect(await token(page, 'bg')).toBe('#121a1b')
  await page.getByLabel('Accent', { exact: true }).fill('#abcdef')
  await expect(page.locator(previewButton).first()).toHaveCSS('background-color', 'rgb(171, 205, 239)')
  await page.getByRole('button', { name: 'Light' }).click()
  expect(await token(page, 'accent')).toBe('#0b6e70')
})

test('theme builder: editing a light colour fills its dark value, unless dark was edited', async ({ page }) => {
  await openBuilder(page)
  await page.getByLabel('Background', { exact: true }).fill('#fff8e7')
  await page.getByRole('button', { name: 'Dark' }).click()
  const generated = await token(page, 'bg')
  expect(generated).not.toBe('#121a1b')
  await page.getByLabel('Background', { exact: true }).fill('#000000')
  await page.getByRole('button', { name: 'Light' }).click()
  await page.getByLabel('Background', { exact: true }).fill('#ffffff')
  await page.getByRole('button', { name: 'Dark' }).click()
  expect(await token(page, 'bg')).toBe('#000000')
})

test('theme builder: radius, shadow and heading font', async ({ page }) => {
  await openBuilder(page)
  await page.locator('summary', { hasText: 'Shape' }).click()
  await page.locator('summary', { hasText: 'Typography' }).click()
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

test('theme builder: the phone toggle narrows the preview to 390px', async ({ page }) => {
  await openBuilder(page)
  await page.getByRole('button', { name: 'Phone width' }).click()
  expect(await page.locator('[data-ui-preview]').evaluate((el) => el.getBoundingClientRect().width)).toBeLessThanOrEqual(390)
  await page.getByRole('button', { name: 'Desktop width' }).click()
  expect(await page.locator('[data-ui-preview]').evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThan(390)
})

test('theme builder: an edit is saved and shows on component pages', async ({ page }) => {
  await openBuilder(page)
  await page.getByLabel('Accent', { exact: true }).fill('#123456')
  await page.goto('/components/button')
  await expect(page.locator('.demo [data-part="button"][data-variant="default"]').first()).toHaveCSS('background-color', 'rgb(18, 52, 86)')
})

test('theme builder: Share copies a /theme?t= link that opens the same theme without saving it', async ({ page, context, browser }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await openBuilder(page)
  await page.getByRole('button', { name: 'Indigo preset' }).click()
  await page.getByLabel('Accent', { exact: true }).fill('#123456')
  await page.getByRole('button', { name: 'Share link' }).click()
  const link = await page.evaluate(() => navigator.clipboard.readText())
  expect(link).toMatch(/\/theme\?t=indigo/)
  const fresh = await (await browser.newContext()).newPage()
  await fresh.goto(new URL(link).pathname + new URL(link).search)
  await fresh.locator('.theme-builder[data-ready]').waitFor()
  expect(await token(fresh, 'accent')).toBe('#123456')
  expect(await fresh.evaluate(() => localStorage.getItem('ui-theme'))).toBeNull()
  await fresh.context().close()
})

test('theme builder: a malformed t= opens the default preset with no error', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/theme?t=%7Bbad')
  await page.locator('.theme-builder[data-ready]').waitFor()
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
  await page.getByRole('button', { name: 'Dark' }).click()
  await page.getByLabel('Accent text', { exact: true }).fill('#4cc9cb')
  await expect(warning).toBeVisible()
})

test('theme builder: on a phone the controls open in a drawer; no sideways scroll', async ({ browser }) => {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 800 } })).newPage()
  await page.goto('/theme')
  await page.locator('.theme-builder[data-ready]').waitFor({ state: 'attached' })
  await expect(page.getByLabel('Accent', { exact: true })).toBeHidden()
  const open = page.getByRole('button', { name: 'Customize' })
  await open.click()
  await expect(page.getByLabel('Accent', { exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByLabel('Accent', { exact: true })).toBeHidden()
  await expect(open).toBeFocused()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await open.click()
  expect(await axeViolations(page)).toEqual([])
  await page.context().close()
})

test('#review: a shared link with a font, a shadow and a dark override restores all three', async ({ page }) => {
  await page.goto("/theme?t=teal~l!font!'Lora'%2C%20Georgia%2C%20serif~l!shadow!none~d!shadow!none~d!accent!%23abcdef")
  await page.locator('.theme-builder[data-ready]').waitFor()
  await expect(page.locator('head link[href*="fonts.googleapis.com"][href*="Lora"]')).toHaveCount(1)
  await page.locator('summary', { hasText: 'Shape' }).click()
  await expect(page.getByLabel('Shadow')).toHaveValue('none')
  await page.getByLabel('Accent', { exact: true }).fill('#123456')
  await page.getByRole('button', { name: 'Dark' }).click()
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
  await page.getByText('Shape').click()
  // A step of the scale, measured inside the preview: 4 × the unit.
  const step4 = () => page.locator('[data-ui-preview]').first().evaluate((el) => {
    const probe = el.appendChild(document.createElement('div'))
    probe.style.padding = 'var(--ui-space-4)'
    const value = getComputedStyle(probe).paddingTop
    probe.remove()
    return value
  })
  expect(await step4()).toBe('16px')
  await page.getByLabel('Density').selectOption('Comfortable')
  expect(await token(page, 'space')).toBe('5px')
  await expect.poll(step4).toBe('20px')
})
