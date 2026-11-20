// Review of #144: in development, an unknown page gets the 404 page (as in preview and on static hosts).
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { expect, test } from 'vitest'
import clarusjs from '../../src/vite/plugin.ts'

test('dev server: unknown addresses get the 404 page with status 404, as static hosts serve 404.html', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'clarus-dev404-'))
  const w = (path: string, text: string) => { mkdirSync(resolve(root, path, '..'), { recursive: true }); writeFileSync(resolve(root, path), text) }
  w('src/pages/index.tscl', '<h1>Home</h1>')
  w('src/pages/404.tscl', '<html><head><title>Not found</title></head><body><h1>Lost</h1></body></html>')
  mkdirSync(resolve(root, 'node_modules'))
  symlinkSync(resolve(import.meta.dirname, '../..'), resolve(root, 'node_modules/clarusjs'), 'dir')
  const server = await createServer({ root, configFile: false, logLevel: 'silent', server: { port: 0 }, plugins: [clarusjs()] })
  await server.listen()
  try {
    const url = server.resolvedUrls!.local[0]!
    const page = await fetch(new URL('/no/such/page', url))
    expect(page.status).toBe(404)
    expect(await page.text()).toContain('<h1>Lost</h1>')
    const asset = await fetch(new URL('/missing.png', url))
    expect(asset.status).toBe(404)
  } finally {
    await server.close()
  }
}, 60_000)
