// Regressions from the slice-1 branch review: non-ESM apps, base paths, a missing client manifest.
import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { createBuilder, preview } from 'vite'
import { expect, test } from 'vitest'
import clarusjs from '../src/vite/plugin.ts'

const fixtures = resolve(import.meta.dirname, 'fixtures')

test('vite build works for an app whose package.json is not ESM', async () => {
  const root = resolve(fixtures, 'site-cjs')
  const builder = await createBuilder({ root, configFile: resolve(root, 'vite.config.ts'), logLevel: 'silent' })
  await builder.buildApp()
  const html = readFileSync(resolve(root, 'dist/client/index.html'), 'utf8')
  expect(html).toContain('<h1>CJS</h1>')
  expect(html).toMatch(/<cl-island c="counter" src="\/assets\//)
}, 120_000)

/** Copy the main fixture's src and public into a fresh temp app, built with an inline config. */
function tempApp() {
  const root = mkdtempSync(resolve(tmpdir(), 'clarusjs-base-'))
  cpSync(resolve(fixtures, 'site/src'), resolve(root, 'src'), { recursive: true })
  cpSync(resolve(fixtures, 'site/public'), resolve(root, 'public'), { recursive: true })
  return root
}

test('with base /docs/, the build and vite preview both serve pages under the base', async () => {
  const root = tempApp()
  const config = { root, configFile: false as const, base: '/docs/', logLevel: 'silent' as const, plugins: [clarusjs()] }
  await (await createBuilder(config)).buildApp()
  const html = readFileSync(resolve(root, 'dist/client/index.html'), 'utf8')
  expect(html).toMatch(/<script type="module" src="\/docs\/assets\//)
  expect(html).toMatch(/<cl-island c="counter" src="\/docs\/assets\//)
  const server = await preview({ ...config, preview: { port: 0 } })
  try {
    const address = server.httpServer.address()
    const origin = `http://localhost:${typeof address === 'object' && address ? address.port : 0}`
    for (const path of ['/docs/', '/docs/about/team', '/docs/about/team/']) {
      const res = await fetch(origin + path)
      expect(res.status, path).toBe(200)
      expect(await res.text(), path).toContain('<h1>')
    }
    expect((await fetch(`${origin}/docs/site.css`)).status).toBe(200)
  } finally {
    await server.close()
  }
}, 120_000)

test('a relative base is rejected with a clear error', async () => {
  const root = tempApp()
  await expect((async () => {
    await (await createBuilder({ root, configFile: false, base: './', logLevel: 'silent', plugins: [clarusjs()] })).buildApp()
  })()).rejects.toThrow(/relative base .* not supported/)
}, 120_000)

test('a server build without the client manifest fails instead of shipping dev URLs', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'clarusjs-nomanifest-'))
  const plugin = clarusjs() as any
  plugin.configResolved({ root, command: 'build', base: '/' })
  expect(existsSync(resolve(root, 'dist/client/.vite/manifest.json'))).toBe(false)
  expect(() => plugin.load.call({}, '\0virtual:clarusjs/server-entry')).toThrow(/client manifest/)
})

test('building twice with the same builder uses the new island chunk and the new page HTML', async () => {
  const root = tempApp()
  const counterFile = resolve(root, 'src/components/counter.clarus')
  const builder = await createBuilder({ root, configFile: false, logLevel: 'silent', plugins: [clarusjs()] })
  await builder.buildApp()
  const first = readFileSync(resolve(root, 'dist/client/index.html'), 'utf8')
  // Change both the script (lands in the island chunk) and the static text (lands only in the page HTML).
  writeFileSync(counterFile, readFileSync(counterFile, 'utf8').replace('count * 2', 'count * 3').replace('Clicked', 'Pressed'))
  writeFileSync(resolve(root, 'src/pages/index.clarus'), readFileSync(resolve(root, 'src/pages/index.clarus'), 'utf8').replace('<h1>Home</h1>', '<h1>Home v2</h1>'))
  await builder.buildApp()
  const second = readFileSync(resolve(root, 'dist/client/index.html'), 'utf8')
  const src = (html: string) => html.match(/<cl-island c="counter" src="([^"]+)"/)![1]
  expect(src(second)).not.toBe(src(first))
  expect(existsSync(resolve(root, 'dist/client', src(second)!.slice(1)))).toBe(true)
  expect(second).toContain('<h1>Home v2</h1>')
  expect(second).toContain('Pressed')
}, 120_000)

test('vite preview resolves a page route that contains a dot', async () => {
  const root = tempApp()
  writeFileSync(resolve(root, 'src/pages/release.v1.clarus'), '<h1>Release 1</h1>')
  const config = { root, configFile: false as const, logLevel: 'silent' as const, plugins: [clarusjs()] }
  await (await createBuilder(config)).buildApp()
  const server = await preview({ ...config, preview: { port: 0 } })
  try {
    const address = server.httpServer.address()
    const origin = `http://localhost:${typeof address === 'object' && address ? address.port : 0}`
    const res = await fetch(`${origin}/release.v1`)
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('<h1>Release 1</h1>')
    expect((await fetch(`${origin}/site.css`)).status).toBe(200)
  } finally {
    await server.close()
  }
}, 120_000)
