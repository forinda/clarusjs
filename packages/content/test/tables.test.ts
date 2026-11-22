// A wide table scrolls sideways on a small screen (the docs theme lets it): keyboard users must be able to focus it
// to scroll it (WCAG 2.1.1; axe's scrollable-region-focusable).
import { expect, test } from 'vitest'
import markdown from '../src/index.ts'

const md = (code: string) => markdown().toTscl(code, '/a/src/pages/x.md', { route: '/x', root: '/a', addDependency: () => {} })

test('a table can take focus, so it can be scrolled from the keyboard', () => {
  expect(md('| a | b |\n|---|---|\n| 1 | 2 |\n')).toContain('<table tabindex="0">')
})
