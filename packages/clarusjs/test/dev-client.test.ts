// Dev pages load Vite's client, islands or not: without it a page that ships no JavaScript never hears a change (a
// <style> edit, a layout edit) and the browser keeps the old page until a manual reload.
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { createServer, type ViteDevServer } from 'vite'
import { afterAll, beforeAll, expect, test } from 'vitest'
import clarusjs from '../src/vite/plugin.ts'

let server: ViteDevServer
let base: string

beforeAll(async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'clarus-devclient-'))
  const w = (path: string, text: string) => { mkdirSync(resolve(root, path, '..'), { recursive: true }); writeFileSync(resolve(root, path), text) }
  w('src/layouts/shell.tscl', '<!doctype html>\n<html><head><title>T</title></head><body><slot /></body></html>\n')
  w('src/pages/index.tscl', "@import shell from '../layouts/shell.tscl'\n<shell><h1>Static</h1></shell>\n<style scoped>\n  h1 { color: orange; }\n</style>\n")
  w('src/pages/part.tscl', '<p>A page without a document of its own</p>\n')
  w('src/pages/mention.tscl', "@import shell from '../layouts/shell.tscl'\n<shell><pre>/@vite/client</pre></shell>\n")
  // An app hook answering with a bodyless HTML response (a 304 from its own cache).
  w('src/server.ts', "export async function handle({ request }: { request: Request }) {\n  if (new URL(request.url).pathname === '/cached') return new Response(null, { status: 304, headers: { 'content-type': 'text/html' } })\n}\n")
  mkdirSync(resolve(root, 'node_modules'))
  symlinkSync(resolve(import.meta.dirname, '..'), resolve(root, 'node_modules/clarusjs'), 'junction')
  server = await createServer({ root, configFile: false, logLevel: 'silent', plugins: [clarusjs()], server: { port: 0 } })
  await server.listen()
  const address = server.httpServer!.address()
  base = `http://localhost:${typeof address === 'object' && address ? address.port : 0}`
}, 60_000)
afterAll(async () => { await server?.close() })

test('a page without islands loads Vite\'s client in dev, so style and template edits reach the browser', async () => {
  const html = await (await fetch(`${base}/`)).text()
  expect(html).toContain('<h1')
  expect(html).toMatch(/<script type="module" src="\/@vite\/client"><\/script>[\s\S]*<\/head>/)
})

test('a page the server puts in a document gets it too', async () => {
  const html = await (await fetch(`${base}/part`)).text()
  expect(html).toContain('A page without a document of its own')
  expect(html).toContain('<script type="module" src="/@vite/client"></script>')
})

test('#445 review: a page that only mentions /@vite/client in its text still gets the script', async () => {
  const html = await (await fetch(`${base}/mention`)).text()
  expect(html).toContain('<pre>/@vite/client</pre>')
  expect(html).toContain('<script type="module" src="/@vite/client"></script>')
})

test('#445 review: a bodyless HTML response (a 304 from an app hook) is sent as it is', async () => {
  const res = await fetch(`${base}/cached`)
  expect(res.status).toBe(304)
})
