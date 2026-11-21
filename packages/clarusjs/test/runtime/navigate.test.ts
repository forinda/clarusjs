// @vitest-environment happy-dom
// #179: one place decides which navigations clarusjs takes over, for the fragment navigator and the client router.
import { afterEach, expect, test, vi } from 'vitest'
import { onNavigate, type Render } from '../../src/runtime/navigate.ts'

type Fake = Parameters<typeof onNavigate>[0] & { handler?: () => Promise<void>; precommit?: () => Promise<void> }
const event = (url: string, over: Partial<Fake> = {}): Fake => {
  const e: Fake = {
    canIntercept: true, hashChange: false, downloadRequest: null, formData: null, navigationType: 'push',
    destination: { url, sameDocument: false }, signal: new AbortController().signal,
    intercept: (options) => { e.handler = options.handler; e.precommit = options.precommitHandler },
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
const assign = vi.fn()
vi.stubGlobal('location', { href: 'http://x/', reload, assign })
afterEach(() => { rendered.length = 0; failing = false; reload.mockClear(); assign.mockClear() })

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

test('a failed render reloads the page once and is reported; that URL is then left to the browser', async () => {
  failing = true
  const e = event('http://x/app/broken')
  nav(e)
  location.href = 'http://x/app/broken' // committed (the browser changes the URL before running handler)
  await expect(e.handler!()).rejects.toThrow('500') // rejected, so the Navigation API reports it (navigateerror)
  await new Promise((r) => setTimeout(r))
  expect(reload).toHaveBeenCalledOnce()
  const again = event('http://x/app/broken')
  nav(again)
  expect(again.handler).toBeUndefined()
})

test('a replaceState while a render is in flight is taken over (it aborts that render); a newer navigation makes the older stale', async () => {
  const currents: (() => Promise<boolean> | boolean)[] = []
  const finishes: (() => void)[] = []
  const slowPick = () => (_: URL, isCurrent: () => Promise<boolean> | boolean) => { currents.push(isCurrent); return new Promise<void>((done) => finishes.push(done)) }
  const slow = event('http://x/slow')
  onNavigate(slow, slowPick)
  const first = slow.handler!()
  const replace = event('http://x/slow#top', { navigationType: 'replace', destination: { url: 'http://x/slow#top', sameDocument: true } })
  onNavigate(replace, slowPick)
  expect(replace.handler).toBeDefined()
  const second = replace.handler!()
  expect(await currents[0]!()).toBe(false)
  expect(await currents[1]!()).toBe(true)
  for (const done of finishes) done()
  await Promise.all([first, second])
  // Once nothing is in flight, the page's own replaceState is left alone again.
  const later = event('http://x/a?x=1', { navigationType: 'replace', destination: { url: 'http://x/a?x=1', sameDocument: true } })
  nav(later)
  expect(later.handler).toBeUndefined()
})

// #182: transition steps, reported to clarusjs/navigation through globalThis.__clNav (when an island loaded it).
type T = { from: URL; to: URL; type: string; phase: string; signal: AbortSignal }
const g = globalThis as { __clNav?: (step: string | undefined, t: T) => unknown }
const attr = () => document.documentElement.dataset.clNavigating
afterEach(() => { delete g.__clNav })

test('steps: loading while fetching, swapping before the DOM change (awaited), swapped after, then idle', async () => {
  const seen: string[] = []
  g.__clNav = async (step, t) => {
    seen.push(`${step} ${attr()} ${t.phase} ${t.from.pathname}>${t.to.pathname} ${t.type}`)
    if (step == 'swapping') { await new Promise((r) => setTimeout(r, 5)); seen.push('waited') }
  }
  const pick = () => async (_: URL, gate: () => Promise<boolean> | boolean) => {
    seen.push(`render ${attr()}`)
    if (await gate()) seen.push(`swap ${attr()}`)
  }
  vi.stubGlobal('location', { href: 'http://x/from', reload })
  const e = event('http://x/to')
  onNavigate(e, pick)
  await e.handler!()
  expect(seen).toEqual([
    'loading loading loading /from>/to push', 'render loading', 'swapping swapping swapping /from>/to push', 'waited',
    'swap swapping', 'swapped swapping swapping /from>/to push', 'undefined undefined swapping /from>/to push',
  ])
  expect(attr()).toBeUndefined()
})

test('without clarusjs/navigation, the phase is still on <html> for CSS', async () => {
  const phases: (string | undefined)[] = []
  const e = event('http://x/css')
  onNavigate(e, () => async (_, gate) => { phases.push(attr()); await gate(); phases.push(attr()) })
  await e.handler!()
  expect(phases).toEqual(['loading', 'swapping'])
  expect(attr()).toBeUndefined()
})

test('a step that throws (an in-between hook) falls back to a page load, reported as an error', async () => {
  g.__clNav = (step) => { if (step == 'swapping') throw new Error('hook') }
  const e = event('http://x/to2')
  onNavigate(e, () => async (_, gate) => { await gate() })
  location.href = 'http://x/to2' // committed
  await expect(e.handler!()).rejects.toThrow('hook')
  await new Promise((r) => setTimeout(r))
  expect(reload).toHaveBeenCalledOnce()
  expect(attr()).toBeUndefined()
})

test('a newer navigation aborts the older one’s signal; the older never swaps', async () => {
  const signals: AbortSignal[] = []
  let release = () => {}
  g.__clNav = (step, t) => {
    if (step != 'swapping') return
    signals.push(t.signal)
    if (signals.length === 1) return new Promise<void>((r) => { release = r })
  }
  const swapped: string[] = []
  const pick = () => async (url: URL, gate: () => Promise<boolean> | boolean) => { if (await gate()) swapped.push(url.pathname) }
  const old = new AbortController()
  const first = event('http://x/one', { signal: old.signal })
  onNavigate(first, pick)
  const one = first.handler!()
  await new Promise((r) => setTimeout(r))
  const second = event('http://x/two')
  onNavigate(second, pick)
  old.abort() // what the browser does to the older navigation
  const two = second.handler!()
  release()
  await Promise.all([one, two])
  expect(signals[0]!.aborted).toBe(true)
  expect(swapped).toEqual(['/two'])
  expect(attr()).toBeUndefined()
})

// #193: where the browser can hold the URL (precommit handlers), it changes only once the page is ready to swap in,
// so aborting before that leaves page and URL as they were. Requests get the navigation's signal.
const precommit = () => {}
afterEach(() => { vi.unstubAllGlobals(); vi.stubGlobal('location', { href: 'http://x/', reload, assign }) })

test('the URL is held while the page loads: committed at the swap step, before the swap; requests get the signal', async () => {
  precommit()
  const seen: string[] = []
  let signal: AbortSignal | undefined
  const e = event('http://x/held')
  onNavigate(e, () => async (_, gate, s) => { signal = s; seen.push('loading'); if (await gate()) seen.push('swap') })
  expect(e.precommit).toBeDefined()
  await e.precommit!() // resolves once the page reached the swap step
  seen.push('commit')
  await e.handler!()
  expect(seen).toEqual(['loading', 'commit', 'swap'])
  expect(signal).toBe(e.signal)
})

test('aborted while loading: the precommit settles, nothing reloads, the phase clears (the URL never changed)', async () => {
  precommit()
  const abort = new AbortController()
  const e = event('http://x/slow', { signal: abort.signal })
  onNavigate(e, () => async (_, __, s) => { await new Promise((_, fail) => s!.addEventListener('abort', () => fail(new DOMException('', 'AbortError')))) })
  const held = e.precommit!()
  abort.abort()
  await held.catch(() => {})
  expect(reload).not.toHaveBeenCalled()
  expect(assign).not.toHaveBeenCalled()
  expect(document.documentElement.dataset.clNavigating).toBeUndefined()
})

test('a failure before the URL changed loads the new page normally (not a reload of the old one)', async () => {
  precommit()
  const e = event('http://x/broken')
  onNavigate(e, () => async () => { throw new Error('500') })
  // Review (#186): the precommit promise rejects with the error itself (reported as navigateerror); the normal load
  // starts after that, so it doesn't turn the failure into a cancellation.
  await expect(e.precommit!()).rejects.toThrow('500')
  expect(assign).not.toHaveBeenCalled()
  await new Promise((r) => setTimeout(r))
  expect(assign).toHaveBeenCalledWith('http://x/broken')
  expect(reload).not.toHaveBeenCalled()
})

test('back/forward and reloads change the URL at once; a browser without precommit handlers only runs handler', async () => {
  for (const navigationType of ['traverse', 'reload']) {
    const e = event(`http://x/${navigationType}`, { navigationType })
    onNavigate(e, () => render)
    expect(e.precommit, navigationType).toBeUndefined()
    await e.handler!()
  }
  const old = event('http://x/old-browser')
  onNavigate(old, () => render)
  await old.handler!() // precommitHandler ignored: the URL changed at once, and the page still renders
  expect(rendered).toEqual(['/traverse', '/reload', '/old-browser'])
})

test('the page’s own replaceState while a held URL loads is left alone, and the navigation goes on to its page', async () => {
  const navigate = vi.fn()
  vi.stubGlobal('navigation', { navigate })
  const e = event('http://x/target')
  onNavigate(e, () => async (_, gate) => { await gate() })
  const held = e.precommit!()
  const own = event('http://x/#top', { navigationType: 'replace', destination: { url: 'http://x/#top', sameDocument: true } })
  onNavigate(own, () => render)
  expect(own.handler).toBeUndefined() // not taken over: the URL never left this page
  await new Promise((r) => setTimeout(r))
  expect(navigate).toHaveBeenCalledWith('http://x/target') // the clicked page still comes
  void held
})

test('review (#186): a navigation cancelled before its handlers run (beforeNavigate) leaves no phase and no held URL', async () => {
  const navigate = vi.fn()
  vi.stubGlobal('navigation', { navigate })
  const cancel = new AbortController()
  const e = event('http://x/cancelled', { signal: cancel.signal })
  onNavigate(e, () => render)
  expect(document.documentElement.dataset.clNavigating).toBe('loading')
  cancel.abort() // the browser aborts it; neither precommitHandler nor handler ever runs
  await new Promise((r) => setTimeout(r))
  expect(document.documentElement.dataset.clNavigating).toBeUndefined()
  const own = event('http://x/?tab=2', { navigationType: 'push', destination: { url: 'http://x/?tab=2', sameDocument: true } })
  onNavigate(own, () => render)
  await new Promise((r) => setTimeout(r))
  expect(navigate).not.toHaveBeenCalled() // not sent to the cancelled URL
})
