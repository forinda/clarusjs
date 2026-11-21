// @vitest-environment happy-dom
// #179: one place decides which navigations clarusjs takes over, for the fragment navigator and the client router.
import { afterEach, expect, test, vi } from 'vitest'
import { onNavigate, type Render } from '../../src/runtime/navigate.ts'

type Fake = Parameters<typeof onNavigate>[0] & { handler?: () => Promise<void> }
const event = (url: string, over: Partial<Fake> = {}): Fake => {
  const e: Fake = {
    canIntercept: true, hashChange: false, downloadRequest: null, formData: null, navigationType: 'push',
    destination: { url, sameDocument: false }, signal: new AbortController().signal,
    intercept: (options) => { e.handler = options.handler },
    ...over,
  }
  return e
}

const rendered: string[] = []
let failing = false
const render: Render = async (url) => { if (failing) throw new Error('500'); rendered.push(url.pathname) }
// Like the router: only its own routes.
const pick = (url: URL) => !url.pathname.startsWith('/static') && render
const nav = (e: Fake) => onNavigate(e, pick)
const reload = vi.fn()
vi.stubGlobal('location', { reload })
afterEach(() => { rendered.length = 0; failing = false; reload.mockClear() })

test('a #hash, downloads, forms, cross-origin and the page’s own pushState/replaceState are left alone', () => {
  const left = [
    event('http://x/a#b', { hashChange: true }),
    event('http://x/file.zip', { downloadRequest: '' }),
    event('http://x/form', { formData: new FormData() }),
    event('http://y/a', { canIntercept: false }),
    event('http://x/a?tab=2', { destination: { url: 'http://x/a?tab=2', sameDocument: true } }),
    event('http://x/a?tab=3', { navigationType: 'replace', destination: { url: 'http://x/a?tab=3', sameDocument: true } }),
  ]
  for (const e of left) nav(e)
  expect(left.filter((e) => e.handler)).toEqual([])
})

test('back/forward between same-document entries is taken over; URLs the picker declines are left alone', async () => {
  const back = event('http://x/guide', { navigationType: 'traverse', destination: { url: 'http://x/guide', sameDocument: true } })
  nav(back)
  await back.handler!()
  const app = event('http://x/app/7')
  nav(app)
  await app.handler!()
  const declined = event('http://x/static/page')
  nav(declined)
  expect(declined.handler).toBeUndefined()
  expect(rendered).toEqual(['/guide', '/app/7'])
})

test('a failed render reloads the page once; that URL is then left to the browser', async () => {
  failing = true
  const e = event('http://x/app/broken')
  nav(e)
  await e.handler!()
  expect(reload).toHaveBeenCalledOnce()
  const again = event('http://x/app/broken')
  nav(again)
  expect(again.handler).toBeUndefined()
})

test('a replaceState while a render is in flight is taken over (it aborts that render); a newer navigation makes the older stale', async () => {
  const currents: (() => boolean)[] = []
  const finishes: (() => void)[] = []
  const slowPick = () => (_: URL, isCurrent: () => boolean) => { currents.push(isCurrent); return new Promise<void>((done) => finishes.push(done)) }
  const slow = event('http://x/slow')
  onNavigate(slow, slowPick)
  const first = slow.handler!()
  const replace = event('http://x/slow#top', { navigationType: 'replace', destination: { url: 'http://x/slow#top', sameDocument: true } })
  onNavigate(replace, slowPick)
  expect(replace.handler).toBeDefined()
  const second = replace.handler!()
  expect(currents[0]!()).toBe(false)
  expect(currents[1]!()).toBe(true)
  for (const done of finishes) done()
  await Promise.all([first, second])
  // Once nothing is in flight, the page's own replaceState is left alone again.
  const later = event('http://x/a?x=1', { navigationType: 'replace', destination: { url: 'http://x/a?x=1', sameDocument: true } })
  nav(later)
  expect(later.handler).toBeUndefined()
})
