// #145: markdown({ components }) imports a component a page uses by its tag, so the page needs no @import line.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'
import markdown from '../src/index.ts'

const root = mkdtempSync(resolve(tmpdir(), 'clarusjs-auto-'))
mkdirSync(resolve(root, 'src/components'), { recursive: true })
for (const f of ['counter.tscl', 'todo-summary.tscl', 'docs-note.tscl']) writeFileSync(resolve(root, 'src/components', f), '<p>x</p>\n')
const md = markdown({ layout: '/src/layouts/docs.tscl', components: '/src/components' })
const page = (code: string) => md.toTscl(code, resolve(root, 'src/pages/guide/intro.md'), { route: '/guide/intro', root, addDependency: () => {} })
const imports = (out: string) => out.split('\n').filter((l) => l.startsWith('@import ') && !l.includes('cl-layout'))

test('a tag naming a file in the directory is imported', () => {
  expect(imports(page('Try it:\n\n<counter [start]="1" />\n'))).toEqual(["@import counter from '/src/components/counter.tscl'"])
})

test('a camelCase tag finds its kebab-case file; a dashed tag its own', () => {
  expect(imports(page('<todoSummary />\n\n<docs-note />\n'))).toEqual([
    "@import todoSummary from '/src/components/todo-summary.tscl'",
    "@import docs-note from '/src/components/docs-note.tscl'",
  ])
})

test('an explicit @import wins', () => {
  expect(imports(page("@import counter from '../../other/counter.tscl'\n\n<counter />\n"))).toEqual(["@import counter from '../../other/counter.tscl'"])
})

test('tags in code fences and spans stay literal: nothing imported for them', () => {
  expect(imports(page('```tscl\n<counter />\n```\n\nInline `<counter />` too.\n'))).toEqual([])
})

test('an unknown tag that looks like a component (camelCase) fails, naming the page and the tag', () => {
  expect(() => page('<todoSumary />\n')).toThrow(/intro\.md: <todoSumary> is not a component in \/src\/components/)
})

test('an unknown dashed tag is left alone (it can be a custom element); plain HTML is untouched', () => {
  expect(imports(page('<my-widget></my-widget>\n\n<div><b>x</b></div>\n'))).toEqual([])
})

test('several directories, searched in order', () => {
  mkdirSync(resolve(root, 'src/ui'), { recursive: true })
  writeFileSync(resolve(root, 'src/ui/badge.tscl'), '<b>x</b>\n')
  const two = markdown({ layout: false, components: ['/src/components', '/src/ui'] })
  const out = two.toTscl('<badge /> <counter />\n', resolve(root, 'src/pages/a.md'), { route: '/a', root, addDependency: () => {} })
  expect(out).toContain("@import badge from '/src/ui/badge.tscl'")
  expect(out).toContain("@import counter from '/src/components/counter.tscl'")
})
