// The cost of a composer: everything a page with one loads, the clarusjs runtime included, is at most 80 KB gzip.
// The emoji list is its own chunk, loaded on the first ":" (outside that figure), and nothing imports it up front.
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { createBuilder } from 'vite'
import { expect, test } from 'vitest'
import clarusjs from 'clarusjs/vite'

const BUDGET = 80 * 1024

test('a page with a composer ships at most 80 KB gzip of JavaScript; emoji load apart, on first use', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'clarusjs-editor-'))
  const w = (path: string, text: string) => { mkdirSync(resolve(root, path, '..'), { recursive: true }); writeFileSync(resolve(root, path), text) }
  // a chat composer made of the parts
  const parts = ['field', 'toolbar', 'tool', 'suggestions', 'count', 'send', 'files'].map((p) => `@import editor${p[0]!.toUpperCase() + p.slice(1)} from '@clarusjs/editor/components/${p}.tscl'`).join('\n')
  w('src/pages/index.tscl', parts + `
<html><head><title>Chat</title></head><body><form>
  <editorField attach="interaction" [id]="'msg'" [maxLength]="500" />
  <editorToolbar [field]="'msg'"><editorTool command="bold" label="Bold">B</editorTool><editorTool command="codeBlock" label="Code block">{}</editorTool></editorToolbar>
  <editorSuggestions [field]="'msg'" char="@" /><editorSuggestions [field]="'msg'" char="/" /><editorSuggestions [field]="'msg'" char=":" />
  <editorCount [field]="'msg'" /><editorFiles /><editorSend [field]="'msg'" />
</form></body></html>
`)
  mkdirSync(resolve(root, 'node_modules/@clarusjs'), { recursive: true })
  symlinkSync(resolve(import.meta.dirname, '../../clarusjs'), resolve(root, 'node_modules/clarusjs'), 'junction')
  symlinkSync(resolve(import.meta.dirname, '..'), resolve(root, 'node_modules/@clarusjs/editor'), 'junction')
  await (await createBuilder({ root, configFile: false, logLevel: 'silent', plugins: [clarusjs()] })).buildApp()

  const assets = resolve(root, 'dist/client/assets')
  // every chunk, the islands' too (their files may sit in folders under assets/)
  const js = readdirSync(assets, { recursive: true }).map(String).filter((f) => f.endsWith('.js')).map((f) => ({ f: f.split(/[\\/]/).pop()!, code: readFileSync(resolve(assets, f), 'utf8') }))
  const emoji = js.filter((c) => c.code.includes('grinning face'))
  expect(emoji.map((c) => c.f)).toHaveLength(1)
  const name = emoji[0]!.f
  // Only ever imported dynamically: import("./emoji-….js"), never a static import.
  for (const c of js) expect(c.code, c.f).not.toMatch(new RegExp(`(?:^|[;}\\s])import[^(]*["']\\./${name.replace(/[.]/g, '\\.')}["']`))
  const gzip = js.filter((c) => c.f !== name).reduce((n, c) => n + gzipSync(c.code, { level: 9 }).length, 0)
  console.log(`composer page: ${gzip} B gzip of ${BUDGET}; emoji: ${gzipSync(emoji[0]!.code, { level: 9 }).length} B`)
  expect(gzip).toBeLessThanOrEqual(BUDGET)
  expect(gzip).toBeGreaterThan(40 * 1024) // ProseMirror is in there: the build measured what it should
}, 180_000)
