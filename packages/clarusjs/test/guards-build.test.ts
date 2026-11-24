// #457: +guard.ts files reach the built server's handler as guards, never as endpoints.
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createBuilder } from 'vite'
import { beforeAll, expect, test } from 'vitest'
import clarusjs from '../src/vite/plugin.ts'

let server: { default: { fetch(r: Request): Promise<Response> } }
const call = (path: string, cookie = '') => server.default.fetch(new Request(`https://x.test${path}`, { headers: cookie ? { cookie } : {} }))

beforeAll(async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'clarus-guards-'))
  const w = (path: string, text: string) => { mkdirSync(resolve(root, path, '..'), { recursive: true }); writeFileSync(resolve(root, path), text) }
  w('src/pages/index.tscl', '<h1>Home</h1>\n')
  w('src/pages/admin/index.tscl', '<h1>Admin</h1>\n')
  w('src/pages/admin/+guard.ts', "import type { GuardContext } from 'clarusjs/server'\nexport function guard({ cookies }: GuardContext) {\n  if (!cookies.get('user')) return new Response(null, { status: 303, headers: { location: '/' } })\n}\n")
  mkdirSync(resolve(root, 'node_modules'))
  symlinkSync(resolve(import.meta.dirname, '..'), resolve(root, 'node_modules/clarusjs'), 'junction')
  await (await createBuilder({ root, configFile: false, logLevel: 'silent', plugins: [clarusjs({ routes: { '/admin/*': 'server' } })] })).buildApp()
  server = await import(`${pathToFileURL(resolve(root, 'dist/server/index.mjs')).href}?t=${Date.now()}`)
}, 120_000)

test('a folder guard protects its server routes in the built handler', async () => {
  expect((await call('/admin')).status).toBe(303)
  expect(await (await call('/admin', 'user=ada')).text()).toMatch(/<h1[^>]*>Admin<\/h1>/)
})

test('+guard.ts is not an endpoint', async () => {
  expect((await call('/admin/+guard')).status).toBe(404)
})
