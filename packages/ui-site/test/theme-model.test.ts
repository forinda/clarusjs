import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'
import { PAIRS, contrast, darkFrom, decode, encode, toCss, type Theme } from '../src/theme/model.ts'
import { presets } from '../src/theme/presets.ts'
import { TOKEN_NAMES } from '../src/theme/names.ts'
import { collapse, tokenRules } from './css.ts'

const themeCss = readFileSync(resolve(import.meta.dirname, '../src/theme.css'), 'utf8')
const MODELESS = ['font', 'font-heading', 'font-mono', 'font-size', 'radius']
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

test('every preset defines all 34 tokens in light and the colour tokens in dark', () => {
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
  const t: Theme = { light: { ...presets.indigo.light, accent: '#123456', font: "'Inter', sans-serif" }, dark: { ...presets.indigo.dark, bg: '#000000' } }
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
