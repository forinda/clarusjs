// The landing page (/): what the library is, a playground of real components, code beside its result, and the ways in.
import { expect, test } from '@playwright/test'
import { presets } from '../src/theme/presets.ts'
import { axeViolations, modes, pageIn } from './helpers.ts'

const rgb = (page: import('@playwright/test').Page, hex: string) => page.evaluate((h) => { const p = document.createElement('p'); p.style.color = h; document.body.append(p); const c = getComputedStyle(p).color; p.remove(); return c }, hex)

test('/: a headline and the ways in: components, blocks, and the theme sheet', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('copy')
  const hero = page.locator('.landing-hero')
  await expect(hero.getByRole('link', { name: 'Browse components' })).toHaveAttribute('href', '/components')
  await expect(hero.getByRole('link', { name: 'See blocks' })).toHaveAttribute('href', '/blocks')
  await hero.getByRole('button', { name: 'Customize the theme' }).click()
  await expect(page.getByRole('dialog', { name: 'Theme' })).toBeVisible()
})

test('/: the playground restyles its components from a preset, the radius and the density', async ({ page }) => {
  await page.goto('/')
  await page.locator('cl-island[c="landing-playground"][data-cl-ready]').waitFor({ state: 'attached' })
  const canvas = page.locator('.landing-canvas')
  const button = canvas.locator('[data-part="button"][data-variant="default"]').first()
  await page.getByRole('button', { name: 'Indigo', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Indigo', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(button).toHaveCSS('background-color', await rgb(page, presets.indigo.light.accent!))
  await page.locator('.landing-playground').getByLabel('Radius').fill('16')
  await expect(button).toHaveCSS('border-top-left-radius', '16px')
  await page.getByRole('button', { name: 'Comfortable' }).click()
  const step4 = () => canvas.evaluate((el) => { const p = el.appendChild(document.createElement('div')); p.style.padding = 'var(--ui-space-4)'; const v = getComputedStyle(p).paddingTop; p.remove(); return v })
  await expect.poll(step4).toBe('20px')
})

test('/: the playground follows the dark scheme', async ({ browser }) => {
  const page = await (await browser.newContext({ colorScheme: 'dark' })).newPage()
  await page.goto('/')
  await page.locator('cl-island[c="landing-playground"][data-cl-ready]').waitFor({ state: 'attached' })
  await page.getByRole('button', { name: 'Rose', exact: true }).click()
  const button = page.locator('.landing-canvas [data-part="button"][data-variant="default"]').first()
  await expect(button).toHaveCSS('background-color', await rgb(page, presets.rose.dark.accent!))
  await page.context().close()
})

test('/: code beside the component it renders', async ({ page }) => {
  await page.goto('/')
  const pair = page.locator('.landing-pair').first()
  await expect(pair.locator('pre')).toContainText('<uiButton')
  await expect(pair.locator('.landing-result [data-part="button"]').first()).toBeVisible()
})

for (const mode of modes) {
  test(`/: passes axe and fits the screen (${mode.label})`, async ({ browser }) => {
    const page = await pageIn(browser, mode)
    await page.goto('/')
    expect(await axeViolations(page)).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.context().close()
  })
}

for (const [where, open] of [['the landing playground', null], ['the Theme sheet', 'sheet']] as const) {
  test(`${where}: the radius slider moves smoothly: the same element, focused, one step per key`, async ({ page }) => {
    await page.goto('/')
    let slider
    if (open) {
      await page.getByRole('button', { name: 'Theme', exact: true }).click()
      await page.locator('.theme-builder[data-ready]').waitFor()
      slider = page.locator('#theme-sheet').getByLabel('Radius')
    } else {
      await page.locator('cl-island[c="landing-playground"][data-cl-ready]').waitFor({ state: 'attached' })
      slider = page.locator('.landing-playground').getByLabel('Radius')
    }
    await slider.focus()
    const start = Number(await slider.inputValue())
    await slider.evaluate((el) => ((el as HTMLElement & { mark?: boolean }).mark = true))
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight')
    await expect(slider).toHaveValue(String(start + 4))
    await expect(slider).toBeFocused()
    expect(await slider.evaluate((el) => (el as HTMLElement & { mark?: boolean }).mark === true)).toBe(true)
  })
}
