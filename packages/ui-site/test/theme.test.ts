import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'

const read = (path: string) => readFileSync(resolve(import.meta.dirname, path), 'utf8')
const collapse = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim()

/** ui.css's token rules: :root, the dark ones for the OS setting and for the theme toggle. */
export function tokenRules(css: string): string {
  const rules = [
    /:root \{[^}]*\}/,
    /@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme='light'\]\) \{[^}]*\}\s*\}/,
    /:root\[data-theme='dark'\] \{[^}]*\}/,
  ].map((re) => css.match(re)?.[0])
  if (rules.some((r) => !r)) throw new Error('ui.css lost one of its token rules')
  return collapse(rules.join('\n'))
}

test('theme.css is ui.css\'s token rules, light and dark', () => {
  const theme = read('../src/theme.css')
  expect(collapse(theme)).toBe(tokenRules(read('../../ui/src/ui.css')))
  for (const token of ['bg', 'fg', 'muted', 'border', 'accent', 'accent-fg', 'accent-soft', 'danger', 'radius', 'shadow', 'font']) {
    expect(theme).toContain(`--ui-${token}:`)
  }
})
