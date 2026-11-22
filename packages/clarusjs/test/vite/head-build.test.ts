// #115 through vite build: the plugin's head option and src/head.ts reach every prerendered page.
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { createBuilder } from 'vite'
import { expect, test } from 'vitest'
import clarusjs from '../../src/vite/plugin.ts'

test('head option and src/head.ts transformHead apply to built pages', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'clarus-head-'))
  const w = (path: string, text: string) => { mkdirSync(resolve(root, path, '..'), { recursive: true }); writeFileSync(resolve(root, path), text) }
  w('src/pages/index.tscl', '<html><head><title>Home</title></head><body><cl-head><meta name="description" content="home"></cl-head><h1>Home</h1></body></html>')
  w('src/head.ts', "export function transformHead(head: string, page: { route: string }): string {\n  return head + `<meta name=\"page\" content=\"${page.route}\">`\n}\n")
  mkdirSync(resolve(root, 'node_modules'))
  symlinkSync(resolve(import.meta.dirname, '../..'), resolve(root, 'node_modules/clarusjs'), 'junction')
  const plugin = clarusjs({ head: { titleTemplate: '%s · Site', tags: [['meta', { name: 'theme-color', content: '#123' }]] } })
  await (await createBuilder({ root, configFile: false, logLevel: 'silent', plugins: [plugin] })).buildApp()
  const html = readFileSync(resolve(root, 'dist/client/index.html'), 'utf8')
  expect(html).toContain('<title>Home · Site</title><meta name="description" content="home"><meta name="theme-color" content="#123"><meta name="page" content="/">')
  expect(html).not.toContain('cl-head')
}, 120_000)

test('site: an invalid url is a config error; a valid one gives built pages canonical URLs', async () => {
  expect(() => clarusjs({ site: { url: 'example.com' } })).toThrow(/site\.url must be an absolute http\(s\) URL/)
  const root = mkdtempSync(resolve(tmpdir(), 'clarus-site-'))
  const w = (path: string, text: string) => { mkdirSync(resolve(root, path, '..'), { recursive: true }); writeFileSync(resolve(root, path), text) }
  w('src/pages/about.tscl', '<html><head><title>About</title></head><body><a href="https://example.com/">home</a></body></html>')
  w('src/pages/index.tscl', '<h1>Home</h1>')
  mkdirSync(resolve(root, 'node_modules'))
  symlinkSync(resolve(import.meta.dirname, '../..'), resolve(root, 'node_modules/clarusjs'), 'junction')
  await (await createBuilder({ root, configFile: false, logLevel: 'silent', plugins: [clarusjs({ site: { url: 'https://example.com' } })] })).buildApp()
  expect(readFileSync(resolve(root, 'dist/client/about/index.html'), 'utf8')).toContain('<link rel="canonical" href="https://example.com/about">')
}, 120_000)
