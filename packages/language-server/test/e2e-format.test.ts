// #303 over LSP: Format Document in a trusted workspace with prettier and @clarusjs/prettier-plugin installed.
import { mkdirSync, mkdtempSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { startLanguageServer, type LanguageServerHandle } from '@volar/test-utils'
import { URI } from 'vscode-uri'
import { afterAll, beforeAll, expect, test } from 'vitest'

const BIN = resolve(import.meta.dirname, '../bin/clarusjs-ls.js')
const PLUGIN = resolve(import.meta.dirname, '../../prettier-plugin')
let server: LanguageServerHandle
let root: string

beforeAll(async () => {
  root = mkdtempSync(resolve(tmpdir(), 'cl-ls-e2e-format-'))
  writeFileSync(resolve(root, 'package.json'), '{"name":"app"}')
  writeFileSync(resolve(root, '.prettierrc'), '{"singleQuote":true,"semi":false}')
  mkdirSync(resolve(root, 'node_modules/@clarusjs'), { recursive: true })
  symlinkSync(realpathSync(resolve(PLUGIN, 'node_modules/prettier')), resolve(root, 'node_modules/prettier'))
  symlinkSync(PLUGIN, resolve(root, 'node_modules/@clarusjs/prettier-plugin'))
  server = startLanguageServer(BIN, root)
  // Workspace folders without the folder-change capability: the server must keep running (it used to exit).
  await server.initialize([{ uri: URI.file(root).toString(), name: 'app' }], { trusted: true }, {})
}, 60_000)
afterAll(() => server?.connection.dispose())

test('Format Document formats a .tscl file with the project\'s Prettier config', async () => {
  writeFileSync(resolve(root, 'a.tscl'), '<script>\nlet a = state("x");\n</script>\n<section>@if (a) {<p>{{ a }}</p>}</section>\n')
  const doc = await server.openTextDocument(resolve(root, 'a.tscl'), 'tscl')
  let edits: Awaited<ReturnType<typeof server.sendDocumentFormattingRequest>> = null
  for (let i = 0; i < 50 && !edits?.length; i++) { // the workspace folder indexes after initialize
    edits = await server.sendDocumentFormattingRequest(doc.uri, { tabSize: 2, insertSpaces: true })
    if (!edits?.length) await new Promise((r) => setTimeout(r, 100))
  }
  expect(edits?.map((e) => e.newText).join('')).toBe("<script>\n  let a = state('x')\n</script>\n<section>\n  @if (a) {\n    <p>{{ a }}</p>\n  }\n</section>\n")
}, 60_000)
