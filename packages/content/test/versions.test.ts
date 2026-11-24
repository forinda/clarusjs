// {since=…}, {deprecated=…}, {removed=…}: when a feature came, and when it goes, beside its heading or in a table.
import { expect, test } from 'vitest'
import markdown from '../src/index.ts'

const html = (code: string) => markdown().toTscl(code, '/a/src/pages/x.md', { route: '/x', root: '/a', addDependency: () => {} })

test('a heading marked since a version: a badge, outside its id and anchor text', () => {
  const out = html('## Fragments {since=0.16.0}\n')
  expect(out).toContain('<h2 id="fragments" tabindex="-1">Fragments <span class="version" data-version="since">Since 0.16.0</span>')
  expect(out).toContain('aria-label="Permalink to Fragments"')
})

test('deprecated and removed, together or alone', () => {
  expect(html('### Old {deprecated=0.17.0 removed=0.18.0}\n')).toContain('<span class="version" data-version="deprecated">Deprecated in 0.17.0, removed in 0.18.0</span>')
  expect(html('### Gone {removed=0.18.0}\n')).toContain('<span class="version" data-version="removed">Removed in 0.18.0</span>')
})

test('in a table cell and in text; not a version, or in code, stays as written', () => {
  expect(html('| a | b |\n|---|---|\n| `@extends` {since=0.16.0} | x |\n')).toContain('<code>&#64;extends</code> <span class="version" data-version="since">Since 0.16.0</span>')
  expect(html('A {since=soon} b\n')).toContain('A {since=soon} b')
  expect(html('`{since=0.16.0}`\n')).toContain('<code>{since=0.16.0}</code>')
})
