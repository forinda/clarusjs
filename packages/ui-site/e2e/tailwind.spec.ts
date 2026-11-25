// The Tailwind twins: the same look as the CSS components (compared on /view/tailwind-parity), and the switch on each
// component page that shows one or the other, remembered.
import { expect, test } from '@playwright/test'

const PROPS = ['display', 'align-items', 'justify-content', 'gap', 'min-height', 'width', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'border-top-width', 'border-top-style', 'border-top-color', 'border-top-left-radius', 'background-color', 'color', 'font-size', 'font-weight',
  'opacity', 'cursor', 'text-decoration-line', 'box-shadow']

test('every Tailwind twin computes the same styles as its CSS component, in every case on the parity page', async ({ page }) => {
  await page.goto('/view/tailwind-parity')
  const pairs = page.locator('[data-pair]')
  expect(await pairs.count()).toBeGreaterThan(20)
  const diffs = await pairs.evaluateAll((all, props) => all.flatMap((pair) => {
    const [css, tw] = [...pair.children] as HTMLElement[]
    const walk = (a: Element, b: Element, path: string): string[] => {
      const sa = getComputedStyle(a), sb = getComputedStyle(b)
      const own = props.filter((p) => sa.getPropertyValue(p) !== sb.getPropertyValue(p)).map((p) => `${pair.getAttribute('data-pair')} ${path} ${p}: ${sa.getPropertyValue(p)} ≠ ${sb.getPropertyValue(p)}`)
      const ka = [...a.children], kb = [...b.children]
      return [...own, ...(ka.length === kb.length ? ka.flatMap((k, i) => walk(k, kb[i]!, `${path}>${k.tagName.toLowerCase()}`)) : [`${pair.getAttribute('data-pair')} ${path}: ${ka.length} ≠ ${kb.length} children`])]
    }
    return walk(css!, tw!, css!.tagName.toLowerCase())
  }), PROPS)
  expect(diffs).toEqual([])
})

test('the Source switch shows the Tailwind file, remembers the choice on the next page, and Needs adds tailwind.css', async ({ page }) => {
  await page.goto('/components/button')
  await page.locator('cl-island[c="source-flavor"][data-cl-ready]').waitFor({ state: 'attached' })
  const flavor = page.getByRole('group', { name: 'Styles' })
  const visibleCode = () => page.locator('[data-flavor-code] .code-block:visible pre').first()
  await expect(flavor.getByRole('button', { name: 'CSS' })).toHaveAttribute('aria-pressed', 'true')
  await expect(visibleCode()).toContainText('<style scoped>')
  await flavor.getByRole('button', { name: 'Tailwind' }).click()
  await expect(visibleCode()).toContainText('class="')
  await expect(visibleCode()).not.toContainText('<style')
  await expect(page.locator('.needs')).toContainText('tailwind.css')
  await page.goto('/components/badge')
  await page.locator('cl-island[c="source-flavor"][data-cl-ready]').waitFor({ state: 'attached' })
  await expect(page.getByRole('group', { name: 'Styles' }).getByRole('button', { name: 'Tailwind' })).toHaveAttribute('aria-pressed', 'true')
})

test('the twins\' Tailwind build loads on the parity page only: the docs pages get none of its utilities (the docs theme has its own, prebuilt)', async ({ page }) => {
  const tailwindLoaded = () => page.evaluate(async () => {
    for (const s of [...document.styleSheets]) {
      const text = s.href ? await fetch(s.href).then((r) => r.text()) : [...s.cssRules].map((r) => r.cssText).join('')
      if (text.includes('data-\\[variant\\=dashed\\]\\:border-dashed')) return true // a utility only the twins use
    }
    return false
  })
  await page.goto('/components/button')
  expect(await tailwindLoaded()).toBe(false)
  await page.goto('/view/tailwind-parity')
  expect(await tailwindLoaded()).toBe(true)
})
