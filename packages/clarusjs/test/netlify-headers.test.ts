// #632 review: Netlify doesn't apply _headers to function responses, so the generated function applies them itself,
// as the Cloudflare worker does: a server-rendered page gets the site's CSP like a static one.
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createBuilder } from 'vite'
import { expect, test } from 'vitest'
import clarusjs from '../src/vite/plugin.ts'

test("adapter 'netlify': the function's responses carry the _headers headers, the route's own winning", async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'clarus-netlify-headers-'))
  const files: Record<string, string> = {
    'src/pages/index.tscl': '<h1>Home</h1>',
    'src/pages/account.tscl': '<h1>Account</h1>',
    'src/pages/api/ping.ts': "export function GET() { return new Response('pong', { headers: { 'cache-control': 'private' } }) }",
  }
  for (const [path, text] of Object.entries(files)) { mkdirSync(resolve(root, path, '..'), { recursive: true }); writeFileSync(resolve(root, path), text) }
  mkdirSync(resolve(root, 'node_modules'))
  symlinkSync(resolve(import.meta.dirname, '..'), resolve(root, 'node_modules/clarusjs'), 'junction')
  await (await createBuilder({ root, configFile: false, logLevel: 'silent', plugins: [clarusjs({
    adapter: 'netlify', routes: { '/account': 'server' }, headers: { '/*': { 'Content-Security-Policy': "default-src 'self'" }, '/api/*': { 'Cache-Control': 'no-store' } },
  })] })).buildApp()
  const fn = (await import(pathToFileURL(resolve(root, '.netlify/v1/functions/clarusjs-server.mjs')).href)) as { default: (r: Request) => Promise<Response> }
  const page = await fn.default(new Request('https://site.example/account'))
  expect(page.headers.get('content-security-policy')).toBe("default-src 'self'")
  expect(page.headers.get('x-content-type-options')).toBe('nosniff')
  const api = await fn.default(new Request('https://site.example/api/ping'))
  expect(await api.text()).toBe('pong')
  expect(api.headers.get('cache-control')).toBe('private')
}, 120_000)
