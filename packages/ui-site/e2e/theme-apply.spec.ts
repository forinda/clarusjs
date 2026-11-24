import { expect, test } from '@playwright/test'
import { toCss } from '../src/theme/model.ts'
import { presets } from '../src/theme/presets.ts'
import { SCOPE, STORAGE_KEY } from '../src/theme/apply.ts'

const red = toCss({ light: { ...presets.teal.light, accent: '#ff0000' }, dark: { ...presets.teal.dark, accent: '#ff0000' } }, SCOPE)
const demoButton = '.demo [data-part="button"][data-variant="default"]'

test('saved theme: shows in demos from the first paint, not in the site chrome', async ({ page }) => {
  await page.goto('/components/button')
  const chrome = await page.locator('header a').first().evaluate((a) => getComputedStyle(a).color)
  await page.addInitScript(([key, css]) => localStorage.setItem(key, css), [STORAGE_KEY, red] as const)
  await page.goto('/components/button')
  expect(await page.evaluate(() => document.head.contains(document.getElementById('ui-theme')))).toBe(true)
  await expect(page.locator(demoButton).first()).toHaveCSS('background-color', 'rgb(255, 0, 0)')
  expect(await page.locator('header a').first().evaluate((a) => getComputedStyle(a).color)).toBe(chrome)
})

test('saved theme: Reset to default theme removes it', async ({ page }) => {
  await page.addInitScript(([key, css]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(key, css); sessionStorage.setItem('seeded', '1') } }, [STORAGE_KEY, red] as const)
  await page.goto('/components/button')
  await page.getByRole('button', { name: 'Reset to default theme' }).click()
  await expect(page.locator(demoButton).first()).not.toHaveCSS('background-color', 'rgb(255, 0, 0)')
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBeNull()
  await expect(page.getByRole('button', { name: 'Reset to default theme' })).toBeHidden()
})

test('saved theme: with storage blocked, pages render with no error', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked') } }) })
  await page.goto('/components/button')
  await expect(page.locator('h1')).toHaveText('Button')
  expect(errors).toEqual([])
})
