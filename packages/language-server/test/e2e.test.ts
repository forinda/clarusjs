// The built server (bin/clarusjs-ls.js) over LSP, as an editor drives it.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { PublishDiagnosticsNotification } from '@volar/language-server/node.js'
import { startLanguageServer, type LanguageServerHandle } from '@volar/test-utils'
import { URI } from 'vscode-uri'
import { afterAll, beforeAll, expect, test } from 'vitest'

const BIN = resolve(import.meta.dirname, '../bin/clarusjs-ls.js')
let server: LanguageServerHandle
let root: string
const published = new Map<string, string[]>()

beforeAll(async () => {
  root = mkdtempSync(resolve(tmpdir(), 'cl-ls-e2e-'))
  mkdirSync(resolve(root, 'src'), { recursive: true })
  writeFileSync(resolve(root, 'package.json'), '{"name":"app"}')
  server = startLanguageServer(BIN, root)
  server.connection.onNotification(PublishDiagnosticsNotification.type, (p) => void published.set(p.uri, p.diagnostics.map((d) => d.message)))
  await server.initialize(URI.file(root).toString(), { trusted: false }, {})
}, 60_000)
afterAll(() => server?.connection.dispose())

test('a broken template gets the compiler\'s error; HTML completion works through the HTML view', async () => {
  const broken = await server.openUntitledDocument('tscl', '<form [engine]="f"></form>\n')
  const diagnostics = await server.sendDocumentDiagnosticRequest(broken.uri)
  const messages = 'items' in diagnostics ? diagnostics.items.map((d) => d.message) : []
  expect(messages.join('\n')).toMatch(/\[engine\] needs a <script>/)
  const typing = await server.openUntitledDocument('tscl', '<p>{{ x }}</p>\n<di')
  const completion = await server.sendCompletionRequest(typing.uri, { line: 1, character: 3 })
  expect(completion?.items.map((i) => i.label)).toContain('div')
}, 60_000)

test('binding forms come through the HTML service: <button [dis…', async () => {
  const doc = await server.openUntitledDocument('tscl', '<button ')
  const completion = await server.sendCompletionRequest(doc.uri, { line: 0, character: 8 })
  expect(completion?.items.map((i) => i.label)).toEqual(expect.arrayContaining(['[disabled]', '(click)']))
}, 60_000)

test('semantic tokens over LSP: the template syntax is coloured', async () => {
  const doc = await server.openUntitledDocument('tscl', '@if (ok) {<p>{{ x }}</p>}\n')
  const tokens = await server.sendSemanticTokensRequest(doc.uri)
  expect(tokens?.data.length).toBeGreaterThanOrEqual(3 * 5) // @if, {{, }}: five numbers each
}, 60_000)
