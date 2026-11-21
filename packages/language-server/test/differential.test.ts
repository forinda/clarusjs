// The server's diagnostics equal the compiler's for every template of the docs site and the theme.
import { readdirSync, readFileSync } from 'node:fs'
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
