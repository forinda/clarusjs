// #117: sitemap.xml with last-updated dates from git.
import { execSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { createBuilder } from 'vite'
import { expect, test } from 'vitest'
import { gitDates, sitemapXml } from '../src/vite/sitemap.ts'
import clarusjs from '../src/vite/plugin.ts'

const git = (root: string, cmd: string, date?: string) => execSync(`git ${cmd}`, {
  cwd: root, stdio: 'pipe',
  env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t', ...(date ? { GIT_COMMITTER_DATE: date, GIT_AUTHOR_DATE: date } : {}) },
})

function repo() {
  const root = mkdtempSync(resolve(tmpdir(), 'clarus-sitemap-'))
  const w = (path: string, text: string) => { mkdirSync(resolve(root, path, '..'), { recursive: true }); writeFileSync(resolve(root, path), text) }
  git(root, 'init -q')
  return { root, w }
}

test('sitemapXml: absolute URLs under the base, dates as YYYY-MM-DD, XML-escaped', () => {
  expect(sitemapXml('https://example.com', '/docs/', [{ path: '/', lastmod: 1700000000 }, { path: '/a&b', lastmod: undefined }])).toBe(
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    '<url><loc>https://example.com/docs/</loc><lastmod>2023-11-14</lastmod></url>\n' +
    '<url><loc>https://example.com/docs/a&amp;b</loc></url>\n</urlset>\n',
  )
})

test('gitDates: one git log gives each file its newest commit; unknown files have none', () => {
  const { root, w } = repo()
  w('src/pages/a.tscl', 'a'); w('src/pages/b.md', 'b')
  git(root, 'add -A'); git(root, 'commit -qm one', '2024-01-01T00:00:00Z')
  w('src/pages/a.tscl', 'a2')
  git(root, 'add -A'); git(root, 'commit -qm two', '2024-03-01T00:00:00Z')
  w('src/pages/new.tscl', 'n')
  const dates = gitDates(root, 'src/pages')
  expect(dates.get(resolve(root, 'src/pages/a.tscl'))).toBe(Date.parse('2024-03-01T00:00:00Z') / 1000)
  expect(dates.get(resolve(root, 'src/pages/b.md'))).toBe(Date.parse('2024-01-01T00:00:00Z') / 1000)
  expect(dates.has(resolve(root, 'src/pages/new.tscl'))).toBe(false)
  expect(gitDates(mkdtempSync(resolve(tmpdir(), 'clarus-nogit-')), 'src/pages').size).toBe(0) // not a repository
})

test('vite build: sitemap of static pages with git dates; noindex, client and server routes left out; SOURCE_DATE_EPOCH for new files', async () => {
  const { root, w } = repo()
  w('src/pages/index.tscl', '<h1>Home</h1>')
  w('src/pages/hidden.tscl', '<html><head><meta name="robots" content="noindex"></head><body>x</body></html>')
  w('src/pages/app.tscl', '<p>client</p>')
  w('src/pages/live.tscl', '<p>server</p>')
  git(root, 'add -A'); git(root, 'commit -qm one', '2024-05-06T00:00:00Z')
  w('src/pages/new.tscl', '<p>new</p>')
  mkdirSync(resolve(root, 'node_modules'))
  symlinkSync(resolve(import.meta.dirname, '..'), resolve(root, 'node_modules/clarusjs'), 'dir')
  process.env.SOURCE_DATE_EPOCH = String(Date.parse('2025-01-02T00:00:00Z') / 1000)
  try {
    const plugin = clarusjs({ site: { url: 'https://example.com' }, routes: { '/app': 'client', '/live': 'server' } })
    await (await createBuilder({ root, configFile: false, logLevel: 'silent', plugins: [plugin] })).buildApp()
  } finally { delete process.env.SOURCE_DATE_EPOCH }
  const xml = readFileSync(resolve(root, 'dist/client/sitemap.xml'), 'utf8')
  expect(xml).toContain('<url><loc>https://example.com/</loc><lastmod>2024-05-06</lastmod></url>')
  expect(xml).toContain('<url><loc>https://example.com/new</loc><lastmod>2025-01-02</lastmod></url>')
  expect(xml).not.toMatch(/hidden|app|live/)
}, 120_000)

test('vite build: no site.url or sitemap: false writes no sitemap', async () => {
  const { root, w } = repo()
  w('src/pages/index.tscl', '<h1>Home</h1>')
  mkdirSync(resolve(root, 'node_modules'))
  symlinkSync(resolve(import.meta.dirname, '..'), resolve(root, 'node_modules/clarusjs'), 'dir')
  for (const options of [{}, { site: { url: 'https://example.com' }, sitemap: false }]) {
    await (await createBuilder({ root, configFile: false, logLevel: 'silent', plugins: [clarusjs(options)] })).buildApp()
    expect(() => readFileSync(resolve(root, 'dist/client/sitemap.xml'))).toThrow()
  }
}, 120_000)
