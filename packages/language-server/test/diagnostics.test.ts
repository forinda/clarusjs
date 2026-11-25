// Template errors: the compiler's, at their place; a syntax error is left to the content mapper when it's configured.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'
import { loadCompiler } from '../src/compiler.ts'
import { diagnosticsFor } from '../src/plugin/diagnostics.ts'
import { Project } from '../src/project.ts'

async function setup(tsconfig?: object) {
  const root = mkdtempSync(resolve(tmpdir(), 'cl-ls-diag-'))
  mkdirSync(resolve(root, 'src'), { recursive: true })
  if (tsconfig) writeFileSync(resolve(root, 'tsconfig.json'), JSON.stringify(tsconfig))
  const project = new Project(root, await loadCompiler(root, false, () => {}))
  await project.load()
  return { project, file: resolve(root, 'src/a.tscl') }
}

test('a compiler rule is reported at its place, with the compiler\'s message', async () => {
  const { project, file } = await setup()
  const [d] = diagnosticsFor(project, file, '<form [engine]="f"></form>\n')
  expect(d).toMatchObject({ message: expect.stringMatching(/^\[engine\] needs a <script>/), source: 'clarusjs', range: { start: { line: 0, character: 6 } } })
})

test('a syntax error: reported without the mapper, left to it with one', async () => {
  const broken = '<p>\n  @if (x {\n'
  const plain = await setup()
  expect(diagnosticsFor(plain.project, plain.file, broken)).toHaveLength(1)
  const mapped = await setup({ contentMappers: [{ package: 'clarusjs', extensions: ['.tscl'] }] })
  expect(diagnosticsFor(mapped.project, mapped.file, broken)).toEqual([])
  // A compiler rule (not a syntax error) is still the server's with the mapper.
  expect(diagnosticsFor(mapped.project, mapped.file, '<form [engine]="f"></form>\n')).toHaveLength(1)
})

test('a correct template has none', async () => {
  const { project, file } = await setup()
  expect(diagnosticsFor(project, file, '<p>hello</p>\n')).toEqual([])
})

test('#279: compile warnings are warnings at their place (a plain <style> is global now)', async () => {
  const { project, file } = await setup()
  const [d] = diagnosticsFor(project, file, '<p>x</p>\n<style>\n  p { color: red; }\n</style>\n')
  expect(d).toMatchObject({ message: expect.stringMatching(/^a plain <style> is global/), severity: 2, source: 'clarusjs', range: { start: { line: 1, character: 0 } } })
  expect(diagnosticsFor(project, file, '<p>x</p>\n<style scoped>\n  p { color: red; }\n</style>\n')).toEqual([])
})

test('#304: lint findings are warnings at their place, tagged with their rule; an ignore comment skips one', async () => {
  const { project, file } = await setup()
  const found = diagnosticsFor(project, file, '<p>\n  <img src="/a.png" />\n</p>\n')
  expect(found).toEqual([{ range: { start: { line: 1, character: 2 }, end: { line: 1, character: 3 } }, message: expect.stringContaining('<img> without alt'), severity: 2, code: 'img-alt', source: 'clarusjs' }])
  expect(diagnosticsFor(project, file, '{{-- clarusjs-ignore img-alt --}}\n<img src="/a.png" />\n')).toEqual([])
})

test('#304: a template that does not compile has its error only (no lint on top)', async () => {
  const { project, file } = await setup()
  expect(diagnosticsFor(project, file, '<form [engine]="f"></form>\n<img src="/a.png" />\n')).toHaveLength(1)
})

test('a lint finding with a fix is a quick fix: one-root wraps the top level in <fragment>', async () => {
  const { quickFixes } = await import('../src/plugin/diagnostics.ts')
  const { project, file } = await setup()
  const text = '<h1>a</h1>\n<p>b</p>\n'
  const [action, ...rest] = quickFixes(project, file, text, { start: { line: 1, character: 0 }, end: { line: 1, character: 0 } })
  expect(rest).toEqual([])
  expect(action).toMatchObject({ title: 'Fix one-root (clarusjs)', kind: 'quickfix' })
  const [edit] = Object.values(action!.edit!.changes!)[0]!
  expect(edit).toEqual({ range: { start: { line: 0, character: 0 }, end: { line: 1, character: 8 } }, newText: '<fragment>\n<h1>a</h1>\n<p>b</p>\n</fragment>' })
  expect(quickFixes(project, file, '<p>a</p>\n', { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } })).toEqual([])
})
