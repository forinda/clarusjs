// @clarusjs/ui: one stylesheet over the parts. Every part's data-part names are styled; tokens have dark values; focus
// is always visible; motion respects reduced motion; and nothing but CSS ships.
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'

const css = readFileSync(resolve(import.meta.dirname, '../src/ui.css'), 'utf8')
const parts = resolve(import.meta.dirname, '../node_modules/@clarusjs/ui-primitives/src')

test('every data-part a part renders has a rule', () => {
  const names = new Set<string>()
  for (const f of readdirSync(parts).filter((f) => f.endsWith('.tscl'))) {
    for (const m of readFileSync(resolve(parts, f), 'utf8').matchAll(/data-part="([\w-]+)"/g)) names.add(m[1]!)
  }
  expect(names.size).toBeGreaterThan(10)
  const missing = [...names].filter((n) => !css.includes(`[data-part='${n}']`))
  expect(missing).toEqual([])
})

test('tokens: every --ui- colour has a dark value, set by the system or by data-theme', () => {
  const light = new Set([...css.matchAll(/(--ui-[\w-]+):\s*(#|rgb|oklch|color-mix)/g)].map((m) => m[1]))
  const dark = css.slice(css.indexOf('prefers-color-scheme: dark'))
  for (const t of light) expect(dark, t).toContain(`${t}:`)
  expect(css).toContain("[data-theme='dark']")
})

test('accessible defaults: a visible focus ring, reduced motion respected, no colour-only state', () => {
  expect(css).toMatch(/:focus-visible\s*\{[^}]*outline/)
  expect(css).toContain('prefers-reduced-motion: reduce')
  expect(css).toMatch(/\[aria-invalid='true'\][^{]*\{[^}]*border/) // an invalid field also changes its border
})

test('nothing but CSS: no JavaScript in the package', () => {
  expect(readdirSync(resolve(import.meta.dirname, '../src'))).toEqual(['ui.css'])
})
