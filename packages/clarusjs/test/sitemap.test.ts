// #117: sitemap.xml with last-updated dates from git.
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { createBuilder } from 'vite'
import { expect, test } from 'vitest'
import { gitDates, sitemapFiles, sitemapXml } from '../src/vite/sitemap.ts'
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
  symlinkSync(resolve(import.meta.dirname, '..'), resolve(root, 'node_modules/clarusjs'), 'junction')
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
  symlinkSync(resolve(import.meta.dirname, '..'), resolve(root, 'node_modules/clarusjs'), 'junction')
  for (const options of [{}, { site: { url: 'https://example.com' }, sitemap: false }]) {
    await (await createBuilder({ root, configFile: false, logLevel: 'silent', plugins: [clarusjs(options)] })).buildApp()
    expect(() => readFileSync(resolve(root, 'dist/client/sitemap.xml'))).toThrow()
  }
}, 120_000)

test('vite build: exclude patterns and a page opt-out (its marker is stripped from the built page)', async () => {
  const { root, w } = repo()
  w('src/pages/index.tscl', '<h1>Home</h1>')
  w('src/pages/drafts/a.tscl', '<p>a</p>')
  w('src/pages/drafts/deep/b.tscl', '<cl-head><meta name="sitemap" content="false"></cl-head><p>b</p>')
  w('src/pages/tags/x.tscl', '<p>x</p>')
  w('src/pages/tags/x/y.tscl', '<p>y</p>')
  w('src/pages/private.tscl', '<html><head><title>P</title></head><body><cl-head><meta name="sitemap" content="false"></cl-head><p>p</p></body></html>')
  mkdirSync(resolve(root, 'node_modules'))
  symlinkSync(resolve(import.meta.dirname, '..'), resolve(root, 'node_modules/clarusjs'), 'junction')
  const plugin = clarusjs({ site: { url: 'https://example.com' }, sitemap: { exclude: ['/drafts/**', '/tags/*'] } })
  await (await createBuilder({ root, configFile: false, logLevel: 'silent', plugins: [plugin] })).buildApp()
  const locs = [...readFileSync(resolve(root, 'dist/client/sitemap.xml'), 'utf8').matchAll(/<loc>https:\/\/example\.com([^<]*)<\/loc>/g)].map((m) => m[1])
  expect(locs.sort()).toEqual(['/', '/tags/x/y'])
  for (const page of ['private', 'drafts/deep/b']) expect(readFileSync(resolve(root, `dist/client/${page}/index.html`), 'utf8')).not.toContain('name="sitemap"')
}, 120_000)

test('vite build: 404.html with root links; /404 not in the sitemap; robots.txt points at the sitemap unless public/ has one', async () => {
  const { root, w } = repo()
  w('src/pages/index.tscl', '<h1>Home</h1>')
  w('src/pages/404.tscl', '<html><head><title>Not found</title></head><body><a href="guide">guide</a></body></html>')
  w('src/pages/guide.tscl', '<h1>Guide</h1>')
  mkdirSync(resolve(root, 'node_modules'))
  symlinkSync(resolve(import.meta.dirname, '..'), resolve(root, 'node_modules/clarusjs'), 'junction')
  const build = async (options: Parameters<typeof clarusjs>[0]) => (await createBuilder({ root, configFile: false, logLevel: 'silent', base: '/docs/', plugins: [clarusjs(options)] })).buildApp()
  await build({ site: { url: 'https://example.com' } })
  expect(readFileSync(resolve(root, 'dist/client/404.html'), 'utf8')).toContain('<a href="/docs/guide">guide</a>')
  expect(readFileSync(resolve(root, 'dist/client/sitemap.xml'), 'utf8')).not.toContain('/404')
  expect(readFileSync(resolve(root, 'dist/client/robots.txt'), 'utf8')).toBe('User-agent: *\nAllow: /\n\nSitemap: https://example.com/docs/sitemap.xml\n')
  w('public/robots.txt', 'User-agent: *\nDisallow: /private\n')
  await build({ site: { url: 'https://example.com' } })
  expect(readFileSync(resolve(root, 'dist/client/robots.txt'), 'utf8')).toBe('User-agent: *\nDisallow: /private\n')
  rmSync(resolve(root, 'public'), { recursive: true })
  await build({ site: { url: 'https://example.com' }, robots: false })
  expect(existsSync(resolve(root, 'dist/client/robots.txt'))).toBe(false)
}, 120_000)

test('review: gitDates reads non-ASCII file names exactly (git quotes them otherwise)', () => {
  const { root, w } = repo()
  w('src/pages/café.md', 'c')
  git(root, 'add -A'); git(root, 'commit -qm one', '2024-02-03T00:00:00Z')
  expect(gitDates(root, 'src/pages').get(resolve(root, 'src/pages/café.md'))).toBe(Date.parse('2024-02-03T00:00:00Z') / 1000)
})

test('review: an absolute base keeps sitemap URLs on the site and 404 links on the site path', () => {
  expect(sitemapXml('https://example.com', 'https://cdn.example.com/docs/', [{ path: '/a', lastmod: undefined }])).toContain('<loc>https://example.com/docs/a</loc>')
})

test('review: route patterns with special characters, and noindex written any valid way', async () => {
  const { root, w } = repo()
  w('src/pages/index.tscl', '<h1>Home</h1>')
  w('src/pages/v(.tscl', '<p>odd name</p>')
  w('src/pages/blog/[slug].tscl', '@input slug: string\n<p>{{ slug }}</p>')
  w('src/pages/blog/[slug].load.ts', 'export const entries = () => [{ slug: "a" }]\nexport const load = ({ params }: { params: { slug: string } }) => ({ slug: params.slug })\n')
  w('src/pages/quiet.tscl', '<p>quiet</p>')
  w('src/pages/404.tscl', '<html><head><title>Not found</title></head><body><a href="blog/a">a post</a></body></html>')
  w('src/head.ts', "export const transformHead = (head: string, page: { route: string }) => page.route === '/quiet' ? head + \"<meta name='robots' content=noindex>\" : head\n")
  mkdirSync(resolve(root, 'node_modules'))
  symlinkSync(resolve(import.meta.dirname, '..'), resolve(root, 'node_modules/clarusjs'), 'junction')
  await (await createBuilder({ root, configFile: false, logLevel: 'silent', base: 'https://cdn.example.com/docs/', plugins: [clarusjs({ site: { url: 'https://example.com' } })] })).buildApp()
  const xml = readFileSync(resolve(root, 'dist/client/sitemap.xml'), 'utf8')
  expect(xml).toContain('<loc>https://example.com/docs/blog/a</loc>')
  expect(xml).not.toContain('quiet')
  expect(readFileSync(resolve(root, 'dist/client/404.html'), 'utf8')).toContain('<a href="/docs/blog/a">a post</a>')
}, 120_000)

test('#390: a page sets its own lastmod (it wins over git), and the marker is stripped from the built page', async () => {
  const { root, w } = repo()
  w('src/pages/index.tscl', '<h1>Home</h1>')
  w('src/pages/news.tscl', '<html><head><title>N</title></head><body><cl-head><meta name="sitemap:lastmod" content="2026-11-01"></cl-head><p>n</p></body></html>')
  git(root, 'add -A')
  git(root, 'commit -qm one', '2024-01-02T00:00:00Z')
  mkdirSync(resolve(root, 'node_modules'))
  symlinkSync(resolve(import.meta.dirname, '..'), resolve(root, 'node_modules/clarusjs'), 'junction')
  await (await createBuilder({ root, configFile: false, logLevel: 'silent', plugins: [clarusjs({ site: { url: 'https://example.com' } })] })).buildApp()
  const xml = readFileSync(resolve(root, 'dist/client/sitemap.xml'), 'utf8')
  expect(xml).toContain('<url><loc>https://example.com/news</loc><lastmod>2026-11-01</lastmod></url>')
  expect(xml).toContain('<url><loc>https://example.com/</loc><lastmod>2024-01-02</lastmod></url>') // others keep git's
  expect(readFileSync(resolve(root, 'dist/client/news/index.html'), 'utf8')).not.toContain('sitemap:lastmod')
}, 120_000)

test('#390: a lastmod that is not a date fails the build, naming the page', async () => {
  const { root, w } = repo()
  w('src/pages/index.tscl', '<cl-head><meta name="sitemap:lastmod" content="last tuesday"></cl-head><h1>Home</h1>')
  mkdirSync(resolve(root, 'node_modules'))
  symlinkSync(resolve(import.meta.dirname, '..'), resolve(root, 'node_modules/clarusjs'), 'junction')
  await expect((await createBuilder({ root, configFile: false, logLevel: 'silent', plugins: [clarusjs({ site: { url: 'https://example.com' } })] })).buildApp())
    .rejects.toThrow(/\/: sitemap:lastmod 'last tuesday' isn't a date \(YYYY-MM-DD\)/)
}, 120_000)

test('#391: sitemapXml writes a page\'s images (the image namespace only when there are any)', () => {
  const xml = sitemapXml('https://example.com', '/', [{ path: '/a', lastmod: undefined, images: ['https://example.com/x.png?a=1&b=2'] }, { path: '/b', lastmod: undefined }])
  expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">')
  expect(xml).toContain('<url><loc>https://example.com/a</loc><image:image><image:loc>https://example.com/x.png?a=1&amp;b=2</image:loc></image:image></url>')
  expect(xml).toContain('<url><loc>https://example.com/b</loc></url>')
  expect(sitemapXml('https://example.com', '/', [{ path: '/b', lastmod: undefined }])).not.toContain('xmlns:image')
})

test('#391: vite build lists each page\'s images, absolute; decorative (alt="") and data: images left out; images: false turns it off', async () => {
  const build = async (sitemap: object) => {
    const { root, w } = repo()
    w('src/pages/guide/a.tscl', '<h1>A</h1><img src="shot.png" alt="A screenshot"><img src="/logo.svg" alt="Logo"><img src="https://cdn.example.org/c.jpg" alt="CDN"><img src="/deco.png" alt=""><img src="data:image/png;base64,AAAA" alt="inline"><img src="/logo.svg" alt="Logo again">')
    w('src/pages/b.tscl', '<p>no images</p>')
    mkdirSync(resolve(root, 'node_modules'))
    symlinkSync(resolve(import.meta.dirname, '..'), resolve(root, 'node_modules/clarusjs'), 'junction')
    await (await createBuilder({ root, configFile: false, logLevel: 'silent', plugins: [clarusjs({ site: { url: 'https://example.com' }, sitemap })] })).buildApp()
    return readFileSync(resolve(root, 'dist/client/sitemap.xml'), 'utf8')
  }
  const xml = await build({})
  const page = /<url><loc>https:\/\/example\.com\/guide\/a<\/loc>(.*?)<\/url>/.exec(xml)![1]!
  expect([...page.matchAll(/<image:loc>([^<]*)<\/image:loc>/g)].map((m) => m[1])).toEqual([
    'https://example.com/guide/shot.png',
    'https://example.com/logo.svg',
    'https://cdn.example.org/c.jpg',
  ])
  expect(xml).toContain('<url><loc>https://example.com/b</loc>')
  expect(await build({ images: false })).not.toContain('image:')
}, 240_000)

test('#392: include adds URLs the build can\'t list (server, client routes): an array or an async function', async () => {
  const build = async (include: unknown) => {
    const { root, w } = repo()
    w('src/pages/index.tscl', '<h1>Home</h1>')
    w('src/pages/shop/[id].tscl', '@input id: string = \'\'\n<p>{{ id }}</p>')
    mkdirSync(resolve(root, 'node_modules'))
    symlinkSync(resolve(import.meta.dirname, '..'), resolve(root, 'node_modules/clarusjs'), 'junction')
    const plugin = clarusjs({ site: { url: 'https://example.com' }, routes: { '/shop/*': 'server' }, sitemap: { include } as never })
    await (await createBuilder({ root, configFile: false, logLevel: 'silent', plugins: [plugin] })).buildApp()
    return [...readFileSync(resolve(root, 'dist/client/sitemap.xml'), 'utf8').matchAll(/<loc>https:\/\/example\.com([^<]*)<\/loc>/g)].map((m) => m[1])
  }
  expect(await build(['/shop/a', '/shop/b', '/'])).toEqual(['/', '/shop/a', '/shop/b']) // '/' once
  expect(await build(async () => ['/shop/c'])).toEqual(['/', '/shop/c'])
  await expect(build(['shop/d'])).rejects.toThrow(/sitemap\.include: 'shop\/d' isn't a path \(start it with \/\)/)
}, 240_000)

test('#393: up to the limit one sitemap.xml; past it, sitemap-1.xml… and sitemap.xml as their index', () => {
  const pages = ['/a', '/b', '/c'].map((path) => ({ path, lastmod: undefined }))
  expect(sitemapFiles('https://example.com', '/docs/', pages.slice(0, 2), 2).map((f) => f.file)).toEqual(['sitemap.xml'])
  const files = sitemapFiles('https://example.com', '/docs/', pages, 2)
  expect(files.map((f) => f.file)).toEqual(['sitemap-1.xml', 'sitemap-2.xml', 'sitemap.xml'])
  expect(files[0]!.xml).toBe(sitemapXml('https://example.com', '/docs/', pages.slice(0, 2)))
  expect(files[1]!.xml).toContain('<loc>https://example.com/docs/c</loc>')
  expect(files[2]!.xml).toBe(
    '<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    '<sitemap><loc>https://example.com/docs/sitemap-1.xml</loc></sitemap>\n' +
    '<sitemap><loc>https://example.com/docs/sitemap-2.xml</loc></sitemap>\n</sitemapindex>\n',
  )
  expect(sitemapFiles('https://example.com', '/', pages).map((f) => f.file)).toEqual(['sitemap.xml']) // 50,000 by default
})

test('#395: sitemapXml writes a page\'s translations as xhtml:link alternates (the namespace only when used)', () => {
  const xml = sitemapXml('https://example.com', '/', [{ path: '/guide', lastmod: undefined, alternates: [{ hreflang: 'en', href: '/guide' }, { hreflang: 'fr', href: '/fr/guide' }, { hreflang: 'x-default', href: 'https://example.com/guide' }] }])
  expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"')
  expect(xml).toContain('<url><loc>https://example.com/guide</loc><xhtml:link rel="alternate" hreflang="en" href="https://example.com/guide"/><xhtml:link rel="alternate" hreflang="fr" href="https://example.com/fr/guide"/><xhtml:link rel="alternate" hreflang="x-default" href="https://example.com/guide"/></url>')
  expect(sitemapXml('https://example.com', '/', [{ path: '/b', lastmod: undefined }])).not.toContain('xmlns:xhtml')
})

test('#395: vite build reads each page\'s <link rel="alternate" hreflang> (in any attribute order) and keeps them in the page', async () => {
  const { root, w } = repo()
  w('src/pages/guide.tscl', `<html><head><title>G</title><cl-head><link rel="alternate" hreflang="en" href="/guide"><link href="/fr/guide" hreflang="fr" rel="alternate"><link rel="alternate" type="application/rss+xml" href="/feed.xml"></cl-head></head><body><p>g</p></body></html>`)
  mkdirSync(resolve(root, 'node_modules'))
  symlinkSync(resolve(import.meta.dirname, '..'), resolve(root, 'node_modules/clarusjs'), 'junction')
  await (await createBuilder({ root, configFile: false, logLevel: 'silent', plugins: [clarusjs({ site: { url: 'https://example.com' } })] })).buildApp()
  const xml = readFileSync(resolve(root, 'dist/client/sitemap.xml'), 'utf8')
  expect(xml).toContain('<xhtml:link rel="alternate" hreflang="en" href="https://example.com/guide"/><xhtml:link rel="alternate" hreflang="fr" href="https://example.com/fr/guide"/>')
  expect(xml).not.toContain('feed.xml') // an alternate without hreflang isn't a translation
  expect(readFileSync(resolve(root, 'dist/client/guide/index.html'), 'utf8')).toContain('hreflang="fr"')
}, 120_000)

test('#396 review: lastmod must be a real calendar date (2026-02-30 is not); leap days and times with a zone are', async () => {
  const build = async (value: string) => {
    const { root, w } = repo()
    w('src/pages/index.tscl', `<cl-head><meta name="sitemap:lastmod" content="${value}"></cl-head><h1>Home</h1>`)
    mkdirSync(resolve(root, 'node_modules'))
    symlinkSync(resolve(import.meta.dirname, '..'), resolve(root, 'node_modules/clarusjs'), 'junction')
    await (await createBuilder({ root, configFile: false, logLevel: 'silent', plugins: [clarusjs({ site: { url: 'https://example.com' } })] })).buildApp()
    return readFileSync(resolve(root, 'dist/client/sitemap.xml'), 'utf8')
  }
  await expect(build('2026-02-30')).rejects.toThrow(/sitemap:lastmod '2026-02-30' isn't a date/)
  await expect(build('2026-13-01')).rejects.toThrow(/isn't a date/)
  expect(await build('2028-02-29')).toContain('<lastmod>2028-02-29</lastmod>')
  expect(await build('2026-11-01T23:30:00-05:00')).toContain('<lastmod>2026-11-02</lastmod>') // as UTC
}, 240_000)

test('#396 review: the markers are removed from every built page, also 404, 500 and client routes', async () => {
  const { root, w } = repo()
  const marked = '<cl-head><meta name="sitemap:lastmod" content="2026-11-01"><meta name="sitemap" content="false"></cl-head>'
  w('src/pages/index.tscl', '<h1>Home</h1>')
  w('src/pages/404.tscl', `${marked}<h1>Not found</h1>`)
  w('src/pages/500.tscl', `${marked}<h1>Error</h1>`)
  w('src/pages/app.tscl', `${marked}<h1>App</h1>`)
  mkdirSync(resolve(root, 'node_modules'))
  symlinkSync(resolve(import.meta.dirname, '..'), resolve(root, 'node_modules/clarusjs'), 'junction')
  await (await createBuilder({ root, configFile: false, logLevel: 'silent', plugins: [clarusjs({ site: { url: 'https://example.com' }, routes: { '/app': 'client' } })] })).buildApp()
  for (const file of ['404/index.html', '404.html', '500/index.html', '500.html', 'app/index.html']) {
    const path = resolve(root, 'dist/client', file)
    if (existsSync(path)) expect(readFileSync(path, 'utf8'), file).not.toMatch(/name="sitemap(:lastmod)?"/)
  }
}, 120_000)

test('#396 review: include doesn\'t bring back a page that exclude, its own opt-out or noindex keeps out', async () => {
  const { root, w } = repo()
  w('src/pages/index.tscl', '<h1>Home</h1>')
  w('src/pages/private.tscl', '<cl-head><meta name="sitemap" content="false"></cl-head><p>p</p>')
  w('src/pages/hidden.tscl', '<cl-head><meta name="robots" content="noindex"></cl-head><p>h</p>')
  mkdirSync(resolve(root, 'node_modules'))
  symlinkSync(resolve(import.meta.dirname, '..'), resolve(root, 'node_modules/clarusjs'), 'junction')
  const plugin = clarusjs({ site: { url: 'https://example.com' }, sitemap: { exclude: ['/drafts/**'], include: ['/drafts/x', '/private', '/hidden', '/shop/a'] } })
  await (await createBuilder({ root, configFile: false, logLevel: 'silent', plugins: [plugin] })).buildApp()
  const locs = [...readFileSync(resolve(root, 'dist/client/sitemap.xml'), 'utf8').matchAll(/<loc>https:\/\/example\.com([^<]*)<\/loc>/g)].map((m) => m[1])
  expect(locs).toEqual(['/', '/shop/a'])
}, 120_000)

test('#396 review: files split by size as well as by count (50 MB each, uncompressed), with the index', () => {
  const pages = ['/a', '/b', '/c'].map((path) => ({ path, lastmod: undefined, images: Array.from({ length: 20 }, (_, i) => `/img/${path.slice(1)}-${i}.png`) }))
  const one = sitemapXml('https://example.com', '/', pages.slice(0, 1)).length
  const files = sitemapFiles('https://example.com', '/', pages, 50_000, one + 10) // room for one page a file
  expect(files.map((f) => f.file)).toEqual(['sitemap-1.xml', 'sitemap-2.xml', 'sitemap-3.xml', 'sitemap.xml'])
  for (const f of files.slice(0, 3)) expect(Buffer.byteLength(f.xml)).toBeLessThanOrEqual(one + 10)
  expect(sitemapFiles('https://example.com', '/', pages).map((f) => f.file)).toEqual(['sitemap.xml']) // 50 MB by default
})
