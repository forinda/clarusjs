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
  await expect(page.getByRole('dialog')).toBeHidden()
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
