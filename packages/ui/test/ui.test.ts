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

test('after the tokens, every rule sits in exactly one named part section (/* part: name */ … /* end part */)', () => {
  const body = css.slice(css.indexOf('/* part: ')).replace(/\}\s*$/, '') // inside @layer components { … }
  const names = [...body.matchAll(/\/\* part: ([\w-]+) \*\//g)].map((m) => m[1]!)
  expect(names).toEqual(['focus', 'buttons', 'dialog', 'sheet', 'popover', 'tooltip', 'menu', 'accordion', 'tabs', 'toggle', 'switch-checkbox', 'radio-group', 'field-select', 'combobox', 'sidebar', 'toast', 'motion'])
  expect(body.match(/\/\* end part \*\//g)?.length).toBe(names.length)
  // Nothing outside a section but comments and whitespace.
  const outside = body.replace(/\/\* part: [\w-]+ \*\/[\s\S]*?\/\* end part \*\//g, '').replace(/\/\*[\s\S]*?\*\//g, '').trim()
  expect(outside).toBe('')
})

const tokenRule = (re: RegExp) => Object.fromEntries([...(css.match(re)?.[1] ?? '').matchAll(/--ui-([\w-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]))
const light = tokenRule(/^:root \{([^}]*)\}/m)
const osDark = tokenRule(/@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme='light'\]\) \{([^}]*)\}/)
const toggleDark = tokenRule(/^:root\[data-theme='dark'\] \{([^}]*)\}/m)
const EXISTING = ['font', 'radius', 'bg', 'fg', 'muted', 'border', 'accent', 'accent-fg', 'accent-soft', 'danger', 'shadow']
const NEW = ['card', 'card-fg', 'popover', 'popover-fg', 'secondary', 'secondary-fg', 'muted-bg', 'accent-soft-fg', 'danger-fg', 'input', 'ring', 'sidebar', 'sidebar-fg', 'sidebar-accent', 'sidebar-accent-fg', 'sidebar-border', 'font-heading', 'font-mono', 'font-size', 'success', 'success-fg', 'warning', 'warning-fg']
const CHART = [1, 2, 3, 4, 5].map((n) => `chart-${n}`)
const SPACE = ['space', ...[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => `space-${n}`), 'control-sm', 'control-md', 'control-lg']
const MODELESS = ['font', 'font-heading', 'font-mono', 'font-size', 'radius', ...SPACE]

test('theme builder: the :root rule defines 40 tokens (5 of them chart colours) and the spacing scale, and both dark rules define every colour token', () => {
  expect(Object.keys(light).sort()).toEqual([...EXISTING, ...NEW, ...CHART, ...SPACE].sort())
  expect(light.space).toBe('4px')
  expect(light['space-6']).toBe('calc(var(--ui-space) * 6)')
  const colours = [...EXISTING, ...NEW, ...CHART, ...SPACE].filter((t) => !MODELESS.includes(t)).sort()
  expect(Object.keys(osDark).sort()).toEqual(colours)
  expect(toggleDark).toEqual(osDark)
})

test('theme builder: new tokens default to today\'s values', () => {
  for (const set of [light, osDark]) {
    expect(set.card).toBe(set.bg)
    expect(set.popover).toBe(set.bg)
    expect(set['card-fg']).toBe(set.fg)
    expect(set['popover-fg']).toBe(set.fg)
    expect(set.ring).toBe(set.accent)
    expect(set.input).toBe(set.border)
    expect(set.secondary).toBe(set['accent-soft'])
    expect(set['secondary-fg']).toBe(set.fg)
    expect(set['muted-bg']).toBe(set['accent-soft'])
    expect(set['accent-soft-fg']).toBe(set.fg)
    expect(set.sidebar).toBe(set.bg)
    expect(set['sidebar-fg']).toBe(set.fg)
    expect(set['sidebar-accent']).toBe(set['accent-soft'])
    expect(set['sidebar-accent-fg']).toBe(set.fg)
    expect(set['sidebar-border']).toBe(set.border)
  }
  expect(light['danger-fg']).toBe('#ffffff')
  expect(light['font-size']).toBe('14px')
  expect(light['font-heading']).toBe('var(--ui-font)')
  expect(light['font-mono']).toBe('ui-monospace, monospace')
})

const rulesPart = css.slice(css.indexOf('/* part: '))
const blockOf = (selector: string) => {
  const i = rulesPart.indexOf(selector + ' {')
  if (i < 0) throw new Error(`no rule ${selector}`)
  return rulesPart.slice(i, rulesPart.indexOf('}', i))
}

test('theme builder: focus outlines use --ui-ring', () => {
  const outlines = [...rulesPart.matchAll(/outline:\s*([^;]+);/g)].map((m) => m[1]!).filter((v) => v !== 'none' && v !== '0')
  expect(outlines.length).toBeGreaterThan(0)
  for (const o of outlines) expect(o).toContain('var(--ui-ring)')
})

test('theme builder: floating surfaces use --ui-popover', () => {
  for (const sel of [":where([data-part='popover'])", ":where([data-part='menu-list'])", ":where([data-part='listbox'])", ":where([data-part='select']) ::picker(select)"]) {
    const b = blockOf(sel)
    expect(b, sel).toMatch(/background:\s*var\(--ui-popover\)/)
    expect(b, sel).toMatch(/color:\s*var\(--ui-popover-fg\)/)
  }
})

test('theme builder: controls border with --ui-input', () => {
  // The combobox's control takes its border from this rule too (its own rule only lays out chips).
  expect(blockOf(":where([data-part='control'])")).toMatch(/border:[^;]*var\(--ui-input\)/)
})

test('theme builder: text sizes scale from --ui-font-size', () => {
  const sizes = [...rulesPart.matchAll(/font-size:\s*([^;]+);/g)].map((m) => m[1]!)
  const fonts = [...rulesPart.matchAll(/(?<![-\w])font:\s*([^;]+);/g)].map((m) => m[1]!)
  expect(sizes.length + fonts.length).toBeGreaterThan(0)
  for (const v of sizes) expect(v).toMatch(/var\(--ui-font-size\)|^inherit$/)
  for (const v of fonts) expect(v).toMatch(/var\(--ui-font-size\)|^inherit$/)
})

test('theme builder: no literal colours outside the token rules', () => {
  // The dialog's backdrop is a black scrim in both modes, on purpose: not a theme colour.
  const noShadow = rulesPart.replace(/\/\*[\s\S]*?\*\//g, '').replace(/::backdrop \{[^}]*\}/, '')
  expect(noShadow).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\boklch\(|\bhsla?\(/)
})

test('theme builder: all rules after the tokens sit in one @layer components; the tokens stay unlayered', () => {
  const after = css.slice(css.indexOf("[data-theme='dark'] {"))
  const rest = after.slice(after.indexOf('}') + 1).trim()
  expect(rest).toMatch(/^@layer components \{[\s\S]*\}$/)
  expect(css.slice(0, css.indexOf('@layer'))).not.toContain('/* part: ')
})

test('#review: ui.css declares Tailwind\'s layer order before anything, so components rank above base wherever it loads', () => {
  expect(css.replace(/^\/\*[\s\S]*?\*\/\s*/, '').startsWith('@layer theme, base, components, utilities;')).toBe(true)
})

test('#review: the dialog takes its text colour from --ui-card-fg (once)', () => {
  const dialog = /:where\(\[data-part='dialog'\]\) \{([^}]*)\}/.exec(css)![1]!
  expect([...dialog.matchAll(/(?<![-\w])color:/g)]).toHaveLength(1)
  expect(dialog).toContain('color: var(--ui-card-fg)')
})

test('#review: sheets size with border-box and inset, not 100vw', () => {
  const sheet = css.slice(css.indexOf('/* part: sheet */'), css.indexOf('/* end part */', css.indexOf('/* part: sheet */')))
  expect(sheet).toContain('box-sizing: border-box')
  expect(sheet).not.toContain('100vw;')
})

test('toast kinds: success, error, info, warning tint the toast from their tokens; the kind word is read, not shown', () => {
  const toast = css.slice(css.indexOf('/* part: toast */'), css.indexOf('/* end part */', css.indexOf('/* part: toast */')))
  for (const [kind, token] of [['success', 'success'], ['error', 'danger'], ['warning', 'warning'], ['info', 'accent']]) {
    expect(toast, kind).toMatch(new RegExp(`\\[data-type='${kind}'\\][^{]*\\{[^}]*var\\(--ui-${token}\\)`))
  }
  expect(toast).toMatch(/:where\(\[data-part='toast-kind'\]\) \{[^}]*clip-path: inset\(50%\)/)
})

test('spacing: every padding, margin and gap is a step of --ui-space, never raw pixels', () => {
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/[^{}]*\{[^{}]*--ui-[\w-]+\s*:[^{}]*\}/g, '')
  for (const [, prop, value] of rules.matchAll(/(?<![-\w])((?:padding|margin)(?:-[a-z-]+)?|gap|row-gap|column-gap)\s*:\s*([^;}]+)/g)) {
    expect(value!.replace(/var\(--ui-space[\w-]*\)/g, '').match(/\d*\.?\d+px/g), `${prop}: ${value}`).toBeNull()
  }
})

test('the token blocks set color-scheme, so native controls (select popups, date pickers, scrollbars) follow light and dark', () => {
  const tokens = css.slice(0, css.indexOf('@layer components'))
  expect(tokens).toMatch(/:root \{[^}]*color-scheme: light;/)
  expect(tokens).toMatch(/@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme='light'\]\) \{[^}]*color-scheme: dark;/)
  expect(tokens).toMatch(/:root\[data-theme='dark'\] \{[^}]*color-scheme: dark;/)
})
