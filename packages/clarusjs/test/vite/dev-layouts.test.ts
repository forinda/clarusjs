// #472: in dev, adding or removing a +layout.tscl reaches the pages under its folder without a restart.
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { expect, test } from 'vitest'
import clarusjs from '../../src/vite/plugin.ts'

test('dev server: a +layout.tscl added wraps the pages under it already served; removed, it no longer does', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'clarus-devlayout-'))
  const w = (path: string, text: string) => { mkdirSync(resolve(root, path, '..'), { recursive: true }); writeFileSync(resolve(root, path), text) }
  w('src/pages/index.tscl', '<h1>Home</h1>\n')
  w('src/pages/admin/users.tscl', '<h1>Users</h1>\n')
  mkdirSync(resolve(root, 'node_modules'))
  symlinkSync(resolve(import.meta.dirname, '../..'), resolve(root, 'node_modules/clarusjs'), 'junction')
  const server = await createServer({ root, configFile: false, logLevel: 'silent', server: { port: 0 }, plugins: [clarusjs()] })
  await server.listen()
  const url = server.resolvedUrls!.local[0]!
  // A page that fails to render isn't a page without its layout: anything but a 200 fails the test.
  const get = async (path: string) => {
    const res = await fetch(new URL(path, url))
    const html = await res.text()
    expect(res.status, html.slice(0, 300)).toBe(200)
    return html
  }
  // The watcher hears the file a moment later: ask until the page changes, or give up.
  const until = async (path: string, ok: (html: string) => boolean) => {
    for (let i = 0; i < 50; i++) {
      const html = await get(path)
      if (ok(html)) return html
      await new Promise((r) => setTimeout(r, 100))
    }
    return get(path)
  }
  try {
    expect(await get('/admin/users')).not.toContain('class="admin"')
    w('src/pages/admin/+layout.tscl', '<div class="admin"><slot /></div>\n')
    expect(await until('/admin/users', (h) => h.includes('class="admin'))).toMatch(/<div class="admin[^"]*"><h1[^>]*>Users<\/h1><\/div>/)
    expect(await get('/')).not.toContain('class="admin') // a page outside the folder
    rmSync(resolve(root, 'src/pages/admin/+layout.tscl'))
    const after = await until('/admin/users', (h) => !h.includes('class="admin'))
    expect(after).not.toContain('class="admin')
    expect(after).toMatch(/<h1[^>]*>Users<\/h1>/)
  } finally {
    await server.close()
  }
}, 60_000)
