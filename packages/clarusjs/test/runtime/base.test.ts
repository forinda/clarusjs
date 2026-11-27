// @vitest-environment happy-dom
// Vite's base (#base): the shared helper the compiler and h() call for URL attributes, and clarusjs/navigation's
// withBase / withoutBase / navigate, which take paths without the base.
import { afterEach, expect, test, vi } from 'vitest'
import { baseUrl } from '../../src/runtime/attrs.ts'

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules() })

test('baseUrl: a root-relative URL attribute gets the base; everything else is as it was', () => {
  const b = (name: string, value: unknown) => baseUrl('/docs/', name, value)
  expect([b('href', '/a'), b('href', '/'), b('src', '/logo.svg'), b('action', '/search'), b('poster', '/p.jpg'), b('cite', '/c'), b('data', '/o.svg'), b('formaction', '/f'), b('xlink:href', '/s.svg#i')])
    .toEqual(['/docs/a', '/docs/', '/docs/logo.svg', '/docs/search', '/docs/p.jpg', '/docs/c', '/docs/o.svg', '/docs/f', '/docs/s.svg#i'])
  for (const v of ['//cdn.x/a', 'https://x/a', 'mailto:a@b', '#h', '?q=1', 'a/b', '', ' /a']) expect(b('href', v), v).toBe(v)
  expect(b('href', 42)).toBe(42)
  expect(b('href', null)).toBe(null)
  expect(b('data-href', '/x')).toBe('/x')
  expect(b('title', '/x')).toBe('/x')
  // already under the base (href(), withBase(), written by hand): left as it is, so the base never doubles
  expect([b('href', '/docs/a'), b('href', '/docs'), b('href', '/docs/'), b('href', '/documents')]).toEqual(['/docs/a', '/docs', '/docs/', '/docs/documents'])
  expect(baseUrl('/guide/', 'href', '/guide/intro')).toBe('/guide/intro') // (so a route starting with the base can't be linked: the build warns)
  expect(baseUrl('/', 'href', '/a')).toBe('/a')
  expect(baseUrl('/docs', 'href', '/a')).toBe('/docs/a') // a base without its slash
})

test('baseUrl: srcset, each candidate (descriptors kept, commas inside a URL kept)', () => {
  expect(baseUrl('/docs/', 'srcset', '/a.png 1x, /b.png 2x')).toBe('/docs/a.png 1x, /docs/b.png 2x')
  expect(baseUrl('/docs/', 'srcset', '/img.png?w=1,2 2x,/c.png 3x')).toBe('/docs/img.png?w=1,2 2x,/docs/c.png 3x')
  expect(baseUrl('/docs/', 'srcset', 'https://x/a.png 1x, /b.png 640w')).toBe('https://x/a.png 1x, /docs/b.png 640w')
  expect(baseUrl('/docs/', 'srcset', '/only.png')).toBe('/docs/only.png')
})

test('addBase and removeBase (what withBase, withoutBase and navigate do with Vite\'s base)', async () => {
  const { addBase, removeBase } = await import('../../src/runtime/navigation.ts')
  expect([addBase('/docs/', '/guide'), addBase('/docs/', '/'), addBase('/docs/', 'https://x'), addBase('/docs/', '#top'), addBase('/docs/', '//x/a'), addBase('/', '/a'), addBase('/docs/', '/docs/guide')]).toEqual(['/docs/guide', '/docs/', 'https://x', '#top', '//x/a', '/a', '/docs/guide'])
  expect([removeBase('/docs/', '/docs/guide'), removeBase('/docs/', '/docs'), removeBase('/docs/', '/docs/'), removeBase('/docs/', '/other'), removeBase('/docs/', '/documents'), removeBase('/', '/a')]).toEqual(['/guide', '/', '/', '/other', '/documents', '/a'])
})

test('at base / (as these tests run), withBase, withoutBase and navigate leave paths alone', async () => {
  const calls: string[] = []
  vi.stubGlobal('navigation', Object.assign(new EventTarget(), { navigate: (url: string) => { calls.push(url); return { finished: Promise.resolve() } } }))
  const nav = await import('../../src/runtime/navigation.ts')
  expect([nav.withBase('/guide'), nav.withoutBase('/guide')]).toEqual(['/guide', '/guide'])
  await nav.navigate('/guide')
  expect(calls).toEqual(['/guide'])
})

test('review: under a full-URL (CDN) base, code paths stay on the site: sitePrefix is empty, as for page links', async () => {
  const { sitePrefix, addBase } = await import('../../src/runtime/navigation.ts')
  expect([sitePrefix('https://cdn.example.com/'), sitePrefix('https://cdn.example.com/app/'), sitePrefix('/docs/'), sitePrefix('/')]).toEqual(['', '', '/docs', ''])
  expect(addBase(sitePrefix('https://cdn.example.com/') + '/', '/account')).toBe('/account')
})
