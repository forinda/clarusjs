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
