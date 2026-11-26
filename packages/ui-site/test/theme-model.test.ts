import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'
import { PAIRS, contrast, darkFrom, decode, encode, toCss, type Theme } from '../src/theme/model.ts'
import { presets } from '../src/theme/presets.ts'
import { TOKEN_NAMES } from '../src/theme/names.ts'
import { collapse, tokenRules } from './css.ts'

const themeCss = readFileSync(resolve(import.meta.dirname, '../src/theme.css'), 'utf8')
const MODELESS = ['font', 'font-heading', 'font-mono', 'font-size', 'radius', 'space']
const luminance = (hex: string) => {
  const c = hex.replace('#', '').match(/../g)!.map((x) => parseInt(x, 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!
}

test('toCss(presets.teal) equals theme.css\'s token rules', () => {
  expect(collapse(toCss(presets.teal))).toBe(tokenRules(themeCss))
})

test('toCss with a scope prefixes the dark selectors, for each selector in the list', () => {
  const css = toCss(presets.teal, '.demo, [data-ui-preview]')
  expect(css).toContain('.demo, [data-ui-preview] {')
  expect(css).toContain(":root:not([data-theme='light']) .demo, :root:not([data-theme='light']) [data-ui-preview] {")
  expect(css).toContain(":root[data-theme='dark'] .demo, :root[data-theme='dark'] [data-ui-preview] {")
})

test('every preset defines all 40 tokens in light and the colour tokens in dark', () => {
  for (const [name, t] of Object.entries(presets)) {
    expect(Object.keys(t.light).sort(), name).toEqual([...TOKEN_NAMES].sort())
    expect(Object.keys(t.dark).sort(), name).toEqual(TOKEN_NAMES.filter((n) => !MODELESS.includes(n)).sort())
  }
})

test('contrast is the WCAG ratio', () => {
  expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 5)
  expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 1)
})

test('darkFrom turns a light background dark and a dark foreground light', () => {
  const dark = darkFrom(presets.teal.light)
  expect(luminance(dark.bg!)).toBeLessThan(0.1)
  expect(luminance(dark.fg!)).toBeGreaterThan(0.7)
  expect(Object.keys(dark).sort()).toEqual(Object.keys(presets.teal.dark).sort())
})

test('encode/decode round-trip an edited preset, carrying only changed tokens', () => {
  const t: Theme = { light: { ...presets.indigo.light, accent: '#123456', font: "'Inter', system-ui, sans-serif" }, dark: { ...presets.indigo.dark, bg: '#000000' } }
  const text = encode(t, 'indigo')
  expect(text.length).toBeLessThan(200)
  expect(decode(text)).toEqual({ base: 'indigo', theme: t })
})

test('decode returns null for junk, an unknown base, a non-hex colour, or a value with ; } or <', () => {
  for (const bad of ['', '{bad', 'nope~l!accent!%23123456', 'teal~l!accent!red', 'teal~l!font!a%3Bb', 'teal~l!font!a%7Db', 'teal~l!font!%3Cx', 'teal~l!nottoken!%23ffffff', 'teal~x!accent!%23ffffff']) {
    expect(decode(bad), bad).toBeNull()
  }
})

test('every preset passes AA on every PAIR in both modes', () => {
  for (const [name, t] of Object.entries(presets)) for (const mode of ['light', 'dark'] as const) {
    for (const [fg, bg] of PAIRS) expect(contrast(t[mode][fg]!, t[mode][bg]!), `${name} ${mode} ${fg}/${bg}`).toBeGreaterThanOrEqual(4.5)
  }
})

test('#review: decode only accepts the fonts, sizes, radii and shadows the builder offers', () => {
  for (const bad of ['teal~l!font!Comic%20Sans', 'teal~l!font!a%2F*b', 'teal~l!font-size!14em', 'teal~l!radius!1px%20(', 'teal~l!shadow!0%200%20red', 'teal~d!shadow!x']) expect(decode(bad), bad).toBeNull()
  expect(decode("teal~l!font!'Inter'%2C%20system-ui%2C%20sans-serif~l!font-size!16px~l!radius!12px~l!shadow!none~d!shadow!none")).not.toBeNull()
})

test('#review: restore() recovers the shadow choice and which dark tokens were set by hand', async () => {
  const { restore } = await import('../src/theme/model.ts')
  const t = { light: { ...presets.teal.light, shadow: 'none' }, dark: { ...presets.teal.dark, shadow: 'none', bg: '#000000' } }
  expect(restore(t)).toEqual({ shadow: 'none', edited: ['bg'] })
  expect(restore(presets.teal)).toEqual({ shadow: 'soft', edited: [] })
})

test('spacing: one --ui-space unit, and the scale from it in the same rule (so a scope that changes the unit rescales)', async () => {
  const { SPACE_STEPS } = await import('../src/theme/model.ts')
  expect(SPACE_STEPS).toEqual([1, 2, 3, 4, 5, 6, 8, 10, 12])
  const css = toCss({ ...presets.teal, light: { ...presets.teal.light, space: '5px' } }, '.demo')
  const first = css.slice(0, css.indexOf('}'))
  expect(first).toContain('--ui-space: 5px;')
  for (const n of SPACE_STEPS) expect(first).toContain(`--ui-space-${n}: calc(var(--ui-space) * ${n});`)
})

test('spacing: decode accepts the densities the builder offers, nothing else', async () => {
  const { DENSITIES } = await import('../src/theme/options.ts')
  expect(DENSITIES.map((d) => d.value)).toEqual(['3px', '4px', '5px'])
  expect(decode('teal~l!space!5px')).not.toBeNull()
  expect(decode('teal~l!space!7px')).toBeNull()
})

test('chart colours: five distinct, each at least 3:1 against the background in every preset and mode', () => {
  for (const [name, t] of Object.entries(presets)) for (const mode of ['light', 'dark'] as const) {
    const set = t[mode]
    const colours = [1, 2, 3, 4, 5].map((n) => set[`chart-${n}`]!)
    expect(new Set(colours).size, `${name} ${mode}`).toBe(5)
    for (const c of colours) expect(contrast(c, set.bg!), `${name} ${mode} ${c}`).toBeGreaterThanOrEqual(3)
  }
  for (const n of [1, 2, 3, 4, 5]) expect(contrast(darkFrom(presets.teal.light)[`chart-${n}`]!, presets.teal.dark.bg!)).toBeGreaterThanOrEqual(3)
})

test('siteCss: the site around the demos takes the theme\'s accent too, light and dark', async () => {
  const { siteCss } = await import('../src/theme/model.ts')
  const { presets } = await import('../src/theme/presets.ts')
  const css = siteCss({ light: { ...presets.teal.light, accent: '#c2185b', 'accent-soft': '#fde7ef' }, dark: { ...presets.teal.dark, accent: '#f48fb1', 'accent-soft': '#3a1422' } })
  expect(css).toContain('html:root {\n  --accent: #c2185b;\n  --accent-soft: #fde7ef;\n')
  expect(css).toContain("html:root[data-theme='dark'] {\n  --accent: #f48fb1;\n  --accent-soft: #3a1422;\n")
  expect(css).toContain("@media (prefers-color-scheme: dark) {\n  html:root:not([data-theme='light']) {\n    --accent: #f48fb1;")
})

test('siteCss: the site\'s own components (the Theme sheet\'s buttons, slider, focus rings) take the accent too', async () => {
  const { siteCss } = await import('../src/theme/model.ts')
  const { presets } = await import('../src/theme/presets.ts')
  const css = siteCss({ light: { ...presets.teal.light, accent: '#c2185b' }, dark: presets.teal.dark })
  for (const token of ['--ui-accent: #c2185b', '--ui-accent-fg:', '--ui-accent-soft:', '--ui-accent-soft-fg:', '--ui-ring:']) expect(css).toContain(token)
})
