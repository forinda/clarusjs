// The built extension: dist/extension.js (the client VS Code loads; only `vscode` and Node built-ins outside it) and
// dist/server.js (the clarusjs language server, bundled), which answers over LSP as VS Code starts it.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { startLanguageServer } from '@volar/test-utils'
import { URI } from 'vscode-uri'
import { beforeAll, expect, test } from 'vitest'

const pkg = resolve(import.meta.dirname, '..')
beforeAll(() => {
  const vite = resolve(pkg, 'node_modules/vite/bin/vite.js')
  execFileSync(process.execPath, [vite, 'build', '--logLevel', 'silent'], { cwd: pkg })
  execFileSync(process.execPath, [vite, 'build', '--mode', 'server', '--logLevel', 'silent'], { cwd: pkg })
}, 120_000)

test('the client bundle needs only vscode and Node built-ins', () => {
  const code = readFileSync(resolve(pkg, 'dist/extension.js'), 'utf8')
  const required = [...code.matchAll(/require\(["']([^"']+)["']\)/g)].map((m) => m[1]!)
  expect(required.filter((r) => r !== 'vscode' && !r.startsWith('node:') && !builtinModules.includes(r))).toEqual([])
  expect(code).toContain('LanguageClient')
})

test('the bundled server answers over LSP: a template error comes back', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'cl-vsix-'))
  const server = startLanguageServer(resolve(pkg, 'dist/server.js'), root)
  try {
    await server.initialize(URI.file(root).toString(), { trusted: false }, {})
    const doc = await server.openUntitledDocument('tscl', '<form [engine]="f"></form>\n')
    const diagnostics = await server.sendDocumentDiagnosticRequest(doc.uri)
    expect('items' in diagnostics ? diagnostics.items.map((d) => d.message).join('\n') : '').toMatch(/\[engine\] needs a <script>/)
  } finally {
    server.connection.dispose()
  }
}, 60_000)

// Size budget, set from the first build with the server (2.6 MB of bundles, a 625 KB .vsix): raising it is a
// deliberate change in its own PR (AGENTS.md).
test('size budget: the two bundles stay within 3 MB', async () => {
  const { statSync } = await import('node:fs')
  const total = ['extension.js', 'server.js'].reduce((n, f) => n + statSync(resolve(pkg, 'dist', f)).size, 0)
  expect(total, `${total} B`).toBeLessThanOrEqual(3 * 1024 * 1024)
})

test('the extension declares limited support for untrusted workspaces (the server then uses its bundled compiler)', () => {
  const manifest = JSON.parse(readFileSync(resolve(pkg, 'package.json'), 'utf8'))
  expect(manifest.capabilities?.untrustedWorkspaces?.supported).toBe('limited')
})

test('the bundled language client calls no minimatch API that minimatch 11 lacks (0.3.0 crashed on startup: n.makeRe is not a function)', () => {
  const client = readFileSync(resolve(import.meta.dirname, '../dist/extension.js'), 'utf8')
  expect(client).not.toMatch(/\.makeRe\(\)/)
})
