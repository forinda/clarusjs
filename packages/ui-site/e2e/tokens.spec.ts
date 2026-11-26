// The token audit: with a saved theme whose brand is pink, every component demo's focus ring (outline, ring shadow or
// focus border, on the control or the box around it) is the brand's, not the default teal. One list of misses.
import { expect, test } from '@playwright/test'
import { brandTokens, siteCss, toCss } from '../src/theme/model.ts'
import { presets } from '../src/theme/presets.ts'
import { SCOPE, STORAGE_KEY } from '../src/theme/apply.ts'
import { components } from '../src/registry.ts'

const pink = brandTokens('#c2185b')
const theme = { light: { ...presets.teal.light, ...pink }, dark: { ...presets.teal.dark, ...pink } }
const BRAND = 'rgb(194, 24, 91)'

test('#tokens: every component\'s focus ring takes the theme\'s brand', async ({ page }) => {
  test.setTimeout(240_000)
  await page.addInitScript(([key, css]) => localStorage.setItem(key, css), [STORAGE_KEY, toCss(theme, SCOPE) + siteCss(theme)] as const)
  const misses: string[] = []
  for (const c of components) {
    await page.goto(`/components/${c.name}`)
    await page.locator('cl-island[data-cl-ready]').first().waitFor({ state: 'attached', timeout: 5000 }).catch(() => {})
    const controls = page.locator('.demo').first().locator('input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex="0"], summary, a[href]')
    const n = Math.min(await controls.count(), 4)
    for (let i = 0; i < n; i++) {
      const el = controls.nth(i)
      if (!(await el.isVisible())) continue
      const seen = await el.evaluate((node: HTMLElement) => {
        node.focus({ focusVisible: true } as FocusOptions)
        const colours: string[] = []
        for (let e: HTMLElement | null = node, k = 0; e && k < 3; e = e.parentElement, k++) {
          const s = getComputedStyle(e)
          if (s.outlineStyle !== 'none') colours.push(s.outlineColor)
          colours.push(s.boxShadow, s.borderTopColor)
        }
        return { focused: document.activeElement === node, colours: colours.join(' ') }
      })
      if (!seen.focused) continue
      if (!seen.colours.includes(BRAND)) misses.push(`${c.name}: ${await el.evaluate((n) => n.outerHTML.slice(0, 70))}`)
    }
  }
  expect(misses).toEqual([])
})

test('#tokens: the OTP input\'s active box (its focus, the real input being unseen) takes the brand', async ({ page }) => {
  await page.addInitScript(([key, css]) => localStorage.setItem(key, css), [STORAGE_KEY, toCss(theme, SCOPE) + siteCss(theme)] as const)
  await page.goto('/components/otp-input')
  await page.locator('cl-island[data-cl-ready]').first().waitFor({ state: 'attached' })
  await page.locator('.demo [data-part="otp-input"]').first().focus()
  const cell = page.locator('.demo [data-part="otp-cell"][data-active="true"]').first()
  await expect(cell).toHaveCSS('border-top-color', BRAND)
})
