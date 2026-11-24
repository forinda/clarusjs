import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'

const read = (path: string) => readFileSync(resolve(import.meta.dirname, path), 'utf8')
import { collapse, tokenRules } from './css.ts'


test('theme.css is ui.css\'s token rules, light and dark', () => {
  const theme = read('../src/theme.css')
  expect(collapse(theme)).toBe(tokenRules(read('../../ui/src/ui.css')))
  for (const token of ['bg', 'fg', 'muted', 'border', 'accent', 'accent-fg', 'accent-soft', 'danger', 'radius', 'shadow', 'font']) {
    expect(theme).toContain(`--ui-${token}:`)
  }
})

test('theme builder: names.ts lists the 34 tokens theme.css defines', async () => {
  const { TOKEN_NAMES } = await import('../src/theme/names.ts')
  const root = read('../src/theme.css').match(/:root \{([^}]*)\}/)![1]!
  expect([...TOKEN_NAMES].sort()).toEqual([...root.matchAll(/--ui-([\w-]+):/g)].map((m) => m[1]).sort())
  expect(TOKEN_NAMES).toHaveLength(34)
})

test('theme builder: tailwind.css maps every colour token, the radius and the fonts into @theme inline', () => {
  const tw = read('../src/tailwind.css')
  expect(tw).toMatch(/@theme inline \{/)
  const map: Record<string, string> = {
    background: 'bg', foreground: 'fg', card: 'card', 'card-foreground': 'card-fg', popover: 'popover', 'popover-foreground': 'popover-fg',
    primary: 'accent', 'primary-foreground': 'accent-fg', secondary: 'secondary', 'secondary-foreground': 'secondary-fg',
    muted: 'muted-bg', 'muted-foreground': 'muted', accent: 'accent-soft', 'accent-foreground': 'accent-soft-fg',
    destructive: 'danger', 'destructive-foreground': 'danger-fg', border: 'border', input: 'input', ring: 'ring',
    sidebar: 'sidebar', 'sidebar-foreground': 'sidebar-fg', 'sidebar-accent': 'sidebar-accent', 'sidebar-accent-foreground': 'sidebar-accent-fg',
    'sidebar-border': 'sidebar-border', success: 'success', 'success-foreground': 'success-fg', warning: 'warning', 'warning-foreground': 'warning-fg',
  }
  for (const [tw_, ui] of Object.entries(map)) expect(tw, tw_).toContain(`--color-${tw_}: var(--ui-${ui});`)
  expect(tw).toContain('--radius-lg: var(--ui-radius);')
  for (const [f, ui] of [['sans', 'font'], ['heading', 'font-heading'], ['mono', 'font-mono']]) expect(tw).toContain(`--font-${f}: var(--ui-${ui});`)
})
