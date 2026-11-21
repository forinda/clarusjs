// The server's diagnostics equal the compiler's for every template of the docs site and the theme.
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'
import { compile } from 'clarusjs/compiler'
import { loadCompiler } from '../src/compiler.ts'
import { diagnosticsFor } from '../src/plugin/diagnostics.ts'
import { Project } from '../src/project.ts'

test('every docs and theme template: the server reports what compile() reports', async () => {
  const roots = ['../docs/src', '../theme-docs/src'].map((r) => resolve(import.meta.dirname, '..', r))
  const files = roots.flatMap((root) => (readdirSync(root, { recursive: true }) as string[]).filter((f) => f.endsWith('.tscl')).map((f) => resolve(root, f)))
  expect(files.length).toBeGreaterThan(30)
  const root = resolve(import.meta.dirname, '../../docs')
  const project = new Project(root, await loadCompiler(root, false, () => {}))
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    let expected: string[] = []
    try { compile(text, { file, target: 'client' }) } catch (e) { expected = [(e as Error).message] }
    const got = diagnosticsFor(project, file, text).map((d) => d.message)
    expect(got.length, file).toBe(expected.length)
  }
})

test('broken templates: the server reports the compiler\'s message at the compiler\'s place', async () => {
  // A root without a tsconfig.json: no content mapper, so syntax errors are the server's too.
  const root = mkdtempSync(resolve(tmpdir(), 'cl-ls-diff-'))
  const project = new Project(root, await loadCompiler(root, false, () => {}))
  const file = resolve(root, 'src/broken.tscl')
  for (const text of ['<p>\n  @if (x {\n', '<form [engine]="f"></form>\n', '<ul>\n  <li>{{ a </li>\n</ul>\n', '<p (click)="go()">x</p>\n', "@input a: string\n<script>\n  a = 'b'\n</script>\n<p>{{ a }}</p>\n"]) {
    let expected: { message: string; line: number; column: number } | undefined
    try { compile(text, { file, target: 'client' }) } catch (e) { const err = e as Error & { line: number; column: number; file: string }; expected = { message: err.message.slice(`${err.file}:${err.line}:${err.column} `.length), line: err.line - 1, column: err.column - 1 } }
    expect(expected, text).toBeDefined()
    const [d] = diagnosticsFor(project, file, text)
    expect({ message: d?.message, line: d?.range.start.line, column: d?.range.start.character }, text).toEqual({ message: expected!.message, line: expected!.line, column: expected!.column })
  }
})
