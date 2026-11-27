// The Tailwind twins: the same look as the CSS components (compared on /view/tailwind-parity), and the switch on each
// component page that shows one or the other, remembered.
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
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

// Parts draw more with CSS than the components do: outlines, a knob that slides, checks that turn, tinted inputs.
const PARTS_PROPS = [...PROPS, 'outline-style', 'outline-color', 'outline-width', 'outline-offset', 'translate', 'rotate', 'transform', 'accent-color',
  'appearance', 'line-height', 'font-family', 'position', 'top', 'left', 'height', 'margin-top', 'margin-bottom', 'transition-property', 'transition-duration', 'content']

// A part's two stylesheets, each alone: the site bundles every component's <style global> on every page, so the parts'
// markup is rendered in an empty page, once with their CSS rules, once with their Tailwind stylesheets compiled.
const PARTS = ['checkbox', 'switch', 'radio-group', 'field', 'select', 'combobox', 'toggle', 'dialog', 'sheet', 'alert-dialog', 'popover', 'tooltip', 'menu', 'toast', 'accordion', 'tabs', 'typography', 'sidebar', 'chip-input']
const registry = resolve(import.meta.dirname, '../src/registry')
const cssOf = (name: string) => {
  const tscl = resolve(registry, `${name}.tscl`)
  return existsSync(tscl) ? /<style global>([\s\S]*?)<\/style>/.exec(readFileSync(tscl, 'utf8'))![1]! : readFileSync(resolve(registry, `${name}.css`), 'utf8')
}
async function tailwindOf(name: string) {
  const { compile } = await import('tailwindcss')
  const req = createRequire(import.meta.url)
  const load = async (id: string, base: string) => ({ path: id, base, content: readFileSync(req.resolve(id === 'tailwindcss' ? 'tailwindcss/index.css' : id), 'utf8') })
  return (await compile(readFileSync(resolve(registry, `${name}.tw.css`), 'utf8'), { base: registry, loadStylesheet: load })).build([])
}

test('every part\'s Tailwind stylesheet computes the same styles as its CSS (each alone, on the same markup)', async ({ page }) => {
  await page.goto('/view/tailwind-parts-css')
  await page.locator('cl-island[data-cl-ready]').first().waitFor({ state: 'attached' })
  const markup = await page.locator('[data-ui-preview]').evaluate((el) => el.outerHTML)
  const theme = readFileSync(resolve(import.meta.dirname, '../src/theme.css'), 'utf8')
  const styles = async (css: string) => {
    await page.setContent(`<!doctype html><html><head><style>${theme}</style><style>${css}</style></head><body>${markup}</body></html>`)
    // Open every overlay: dialogs as modals (stacked), popovers as manual ones so opening one doesn't close another.
    await page.evaluate(() => {
      for (const d of document.querySelectorAll('dialog')) d.showModal()
      for (const p of document.querySelectorAll<HTMLElement>('[popover]')) { p.popover = 'manual'; p.showPopover() }
    })
    return page.locator('[data-sample]').evaluateAll((samples, props) => samples.flatMap((sample) => {
      const out: string[] = []
      const walk = (el: Element, path: string) => {
        for (const pseudo of [null, '::after', '::before', ...(el.matches('dialog, [popover]') ? ['::backdrop'] : [])]) {
          const s = getComputedStyle(el, pseudo)
          if (pseudo && pseudo !== '::backdrop' && s.content === 'none') continue
          // The same look, written differently: Tailwind turns with rotate/translate (CSS here with transform), rounds
          // "full" with an infinite radius, puts four transparent rings before a shadow; no border has no colour.
          const v = (p: string) => s.getPropertyValue(p)
          const turn = new DOMMatrix([v('translate') !== 'none' ? `translate(${v('translate').split(' ').join(',')})` : '', v('rotate') !== 'none' ? `rotate(${v('rotate')})` : '', v('transform') !== 'none' ? v('transform') : ''].join(' ').trim() || 'none').toString()
          const value = (p: string) =>
            // Not rendered (a closed list): Chrome resolves transform to none there, but not rotate/translate.
            p === 'translate' || p === 'rotate' ? '' : p === 'transform' ? (el.getClientRects().length ? turn : '')
              : p === 'border-top-left-radius' && parseFloat(v(p)) >= 999 ? 'full'
              : p === 'box-shadow' ? v(p).replace(/rgba\(0, 0, 0, 0\) 0px 0px 0px 0px(, )?/g, '') || 'none'
              : p === 'border-top-color' && v('border-top-style') === 'none' ? '' : v(p)
          out.push(`${path}${pseudo ?? ''} ${props.map(value).join(' | ')}`)
        }
        ;[...el.children].forEach((k, i) => walk(k, `${path}>${k.tagName.toLowerCase()}${i}`))
      }
      walk(sample, sample.getAttribute('data-sample')!)
      return out
    }), PARTS_PROPS)
  }
  // One part at a time: stylesheets repeat shared rules (sheet.css carries dialog's), so together a later copy would
  // hide a difference in an earlier one.
  const diffs: string[] = []
  for (const part of PARTS) {
    const css = await styles(cssOf(part))
    const tw = await styles(await tailwindOf(part))
    expect(tw.length, part).toBe(css.length)
    diffs.push(...css.flatMap((line, i) => {
      const [path, ...a] = line.split(' ')
      const [, ...b] = tw[i]!.split(' ')
      const av = a.join(' ').split(' | '), bv = b.join(' ').split(' | ')
      return PARTS_PROPS.flatMap((p, k) => (av[k] === bv[k] ? [] : [`${part}.tw.css: ${path} ${p}: ${av[k]} ≠ ${bv[k]}`]))
    }))
  }
  expect(diffs).toEqual([])
})

test('a part\'s Source switch: CSS shows its component; Tailwind shows its twin and the stylesheet it imports', async ({ page }) => {
  await page.goto('/components/switch')
  await page.locator('cl-island[c="source-flavor"][data-cl-ready]').waitFor({ state: 'attached' })
  const visible = () => page.locator('[data-flavor-code] .code-block:visible pre').allInnerTexts()
  const flavor = page.getByRole('group', { name: 'Styles' })
  await flavor.getByRole('button', { name: 'CSS' }).click()
  expect((await visible()).length).toBe(1)
  expect((await visible())[0]).toContain('<style global>')
  await flavor.getByRole('button', { name: 'Tailwind' }).click()
  const tw = await visible()
  expect(tw.length).toBe(2)
  expect(tw[0]).toContain("@import './switch.tw.css'")
  expect(tw[1]).toContain('@apply')
})
