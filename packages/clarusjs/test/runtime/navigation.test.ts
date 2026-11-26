// @vitest-environment happy-dom
// #180: clarusjs/navigation moves between pages from islands, through whatever navigator the page has.
import { afterEach, expect, test, vi } from 'vitest'

class FakeNavigation extends EventTarget {
  calls: [string, object][] = []
  navigate(url: string, options: object) {
    this.calls.push([url, options])
    return { finished: Promise.resolve() }
  }
}

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); delete (globalThis as { __clNav?: unknown }).__clNav })

test('navigate() goes through the Navigation API (so fragments or the router take over), push or replace, with state', async () => {
  const navigation = new FakeNavigation()
  vi.stubGlobal('navigation', navigation)
  const { navigate } = await import('../../src/runtime/navigation.ts')
  await navigate('/guide/lists')
  await navigate(new URL('http://localhost:3000/guide/holes'), { replace: true, state: { from: 'search' } })
  expect(navigation.calls).toEqual([
    ['/guide/lists', { history: 'auto', state: undefined, info: { scroll: true } }],
    ['http://localhost:3000/guide/holes', { history: 'replace', state: { from: 'search' }, info: { scroll: true } }],
  ])
})

test('a navigation superseded by a newer one resolves; a failed one rejects', async () => {
  const navigation = new FakeNavigation()
  navigation.navigate = (url) => ({ finished: Promise.reject(url === '/old' ? new DOMException('', 'AbortError') : new Error('500')) })
  vi.stubGlobal('navigation', navigation)
  const { navigate } = await import('../../src/runtime/navigation.ts')
  await expect(navigate('/old')).resolves.toBeUndefined()
  await expect(navigate('/broken')).rejects.toThrow('500')
})

test('without the Navigation API, navigate() is a normal page load', async () => {
  const assign = vi.fn()
  const replace = vi.fn()
  vi.stubGlobal('location', { href: 'http://localhost:3000/', assign, replace })
  const { navigate } = await import('../../src/runtime/navigation.ts')
  await navigate('/a')
  await navigate('/b', { replace: true })
  expect(assign).toHaveBeenCalledWith('/a')
  expect(replace).toHaveBeenCalledWith('/b')
})

test('currentUrl follows the current entry', async () => {
  const navigation = new FakeNavigation()
  vi.stubGlobal('navigation', navigation)
  history.replaceState(null, '', '/start')
  const { currentUrl } = await import('../../src/runtime/navigation.ts')
  expect(currentUrl.get()?.pathname).toBe('/start')
  history.replaceState(null, '', '/next?x=1')
  navigation.dispatchEvent(new Event('currententrychange'))
  expect(currentUrl.get()?.href).toBe(`${location.origin}/next?x=1`)
})

test('back() goes back one entry', async () => {
  const back = vi.spyOn(history, 'back').mockImplementation(() => {})
  const { back: goBack } = await import('../../src/runtime/navigation.ts')
  goBack()
  expect(back).toHaveBeenCalledOnce()
})

// #181: hooks, released with the island that registered them.
class Navigate extends Event {
  navigationType = 'push'
  destination: { url: string }
  constructor(url: string, cancelable = true) { super('navigate', { cancelable }); this.destination = { url } }
}

test('beforeNavigate sees where a navigation goes and can cancel it', async () => {
  const navigation = new FakeNavigation()
  vi.stubGlobal('navigation', navigation)
  const { beforeNavigate } = await import('../../src/runtime/navigation.ts')
  const seen: string[] = []
  beforeNavigate((to, nav) => { seen.push(`${nav.type} ${to.pathname}`); if (to.pathname === '/stay') nav.cancel() })
  const go = new Navigate('http://localhost:3000/go')
  const stay = new Navigate('http://localhost:3000/stay')
  navigation.dispatchEvent(go)
  navigation.dispatchEvent(stay)
  expect(seen).toEqual(['push /go', 'push /stay'])
  expect([go.defaultPrevented, stay.defaultPrevented]).toEqual([false, true])
})

test('afterNavigate runs once the new page is in; onNavigateError gets the error', async () => {
  const navigation = new FakeNavigation()
  vi.stubGlobal('navigation', navigation)
  const { afterNavigate, onNavigateError } = await import('../../src/runtime/navigation.ts')
  const after: string[] = []
  const errors: string[] = []
  afterNavigate((to) => after.push(to.pathname))
  onNavigateError((to, error) => errors.push(`${to.pathname} ${(error as Error).message}`))
  history.replaceState(null, '', '/arrived')
  navigation.dispatchEvent(new Event('navigatesuccess'))
  navigation.dispatchEvent(Object.assign(new Event('navigateerror'), { error: new Error('500') }))
  expect(after).toEqual(['/arrived'])
  expect(errors).toEqual(['/arrived 500'])
})

test('hooks registered in an island are released with it', async () => {
  const navigation = new FakeNavigation()
  vi.stubGlobal('navigation', navigation)
  const { afterNavigate } = await import('../../src/runtime/navigation.ts')
  const { scope } = await import('../../src/runtime/signals.ts')
  let runs = 0
  const release = scope(() => afterNavigate(() => runs++))
  navigation.dispatchEvent(new Event('navigatesuccess'))
  release()
  navigation.dispatchEvent(new Event('navigatesuccess'))
  expect(runs).toBe(1)
})

// #182: the navigator reports each step to globalThis.__clNav; the module runs the hooks and updates the store.
type Step = (step: string | undefined, t: object) => Promise<void>
const step = () => (globalThis as { __clNav?: Step }).__clNav!

test('navigating follows the steps, as a new value each time, and is null when idle', async () => {
  const { navigating } = await import('../../src/runtime/navigation.ts')
  expect(navigating.get()).toBeNull()
  const t = { phase: 'loading', to: new URL('http://x/a') }
  await step()('loading', t)
  const first = navigating.get()
  expect(first).toMatchObject({ phase: 'loading' })
  t.phase = 'swapping'
  await step()('swapping', t)
  expect(navigating.get()).not.toBe(first)
  expect(navigating.get()).toMatchObject({ phase: 'swapping' })
  await step()(undefined, t)
  expect(navigating.get()).toBeNull()
})

test('beforeSwap and afterSwap run at their step, in order, awaited, and are released with their island', async () => {
  const { beforeSwap, afterSwap } = await import('../../src/runtime/navigation.ts')
  const { scope } = await import('../../src/runtime/signals.ts')
  const seen: string[] = []
  const release = scope(() => {
    beforeSwap(async () => { await new Promise((r) => setTimeout(r, 5)); seen.push('before 1') })
    beforeSwap(() => { seen.push('before 2') })
    afterSwap(() => { seen.push('after') })
  })
  const t = { phase: 'loading' }
  await step()('loading', t)
  await step()('swapping', t)
  await step()('swapped', t)
  expect(seen).toEqual(['before 1', 'before 2', 'after'])
  release()
  await step()('swapping', t)
  await step()('swapped', t)
  expect(seen).toHaveLength(3)
})

// #193
test('abort() stops the navigation in progress, as the browser’s stop button does', async () => {
  const stop = vi.fn()
  vi.stubGlobal('stop', stop)
  const { abort } = await import('../../src/runtime/navigation.ts')
  abort()
  expect(stop).toHaveBeenCalledOnce()
})

test('review (#186): onNavigateError reports the page it was going to, also when its URL never changed', async () => {
  const navigation = new FakeNavigation()
  vi.stubGlobal('navigation', navigation)
  const { onNavigateError } = await import('../../src/runtime/navigation.ts')
  const errors: string[] = []
  onNavigateError((to) => errors.push(to.pathname))
  history.replaceState(null, '', '/start')
  navigation.dispatchEvent(new Navigate('http://localhost:3000/broken'))
  navigation.dispatchEvent(Object.assign(new Event('navigateerror'), { error: new Error('500') }))
  expect(errors).toEqual(['/broken'])
})

test('review (#186): a hook whose island is released while an earlier hook runs is skipped', async () => {
  const { beforeSwap } = await import('../../src/runtime/navigation.ts')
  const { scope } = await import('../../src/runtime/signals.ts')
  const seen: string[] = []
  let releaseSecond = () => {}
  scope(() => beforeSwap(async () => { seen.push('first'); releaseSecond() }))
  releaseSecond = scope(() => beforeSwap(() => { seen.push('second') }))
  await step()('swapping', { phase: 'swapping' })
  expect(seen).toEqual(['first'])
})

// #183: view transitions, from the navigator's steps: no bytes in the navigation scripts.
test('viewTransitions(): the swap runs inside document.startViewTransition, after beforeSwap; it ends at swapped', async () => {
  const seen: string[] = []
  let finished: Promise<unknown> | undefined
  ;(document as { startViewTransition?: unknown }).startViewTransition = (update: () => Promise<unknown>) => {
    seen.push('snapshot')
    finished = Promise.resolve().then(update)
    return { finished, ready: Promise.resolve() }
  }
  const { viewTransitions, beforeSwap } = await import('../../src/runtime/navigation.ts')
  viewTransitions()
  beforeSwap(() => { seen.push('beforeSwap') })
  const t = { phase: 'loading' }
  await step()('loading', t)
  await step()('swapping', t)
  seen.push('swap') // the navigator swaps once the swapping step resolves
  let ended = false
  void finished!.then(() => (ended = true))
  await new Promise((r) => setTimeout(r))
  expect(ended).toBe(false) // the transition waits for the new page
  await step()('swapped', t)
  await step()(undefined, t)
  await new Promise((r) => setTimeout(r))
  expect(ended).toBe(true)
  expect(seen).toEqual(['beforeSwap', 'snapshot', 'swap'])
  delete (document as { startViewTransition?: unknown }).startViewTransition
})

// A newer page change (Back before this one swapped) skips the transition: ready rejects, and nobody is told.
test('viewTransitions(): a skipped transition is no unhandled rejection', async () => {
  const unhandled: unknown[] = []
  const onUnhandled = (e: unknown) => unhandled.push(e)
  process.on('unhandledRejection', onUnhandled)
  ;(document as { startViewTransition?: unknown }).startViewTransition = (update: () => Promise<unknown>) => {
    const finished = Promise.resolve().then(update)
    return { finished, ready: Promise.reject(new DOMException('Transition was skipped. New ViewTransition started', 'AbortError')) }
  }
  const { viewTransitions } = await import('../../src/runtime/navigation.ts')
  viewTransitions()
  const t = { phase: 'loading' }
  await step()('swapping', t)
  await step()(undefined, t)
  await new Promise((r) => setTimeout(r, 10))
  process.off('unhandledRejection', onUnhandled)
  expect(unhandled).toEqual([])
  delete (document as { startViewTransition?: unknown }).startViewTransition
})

test('without viewTransitions(), or without the browser API, swaps are instant as before', async () => {
  const start = vi.fn()
  ;(document as { startViewTransition?: unknown }).startViewTransition = start
  await import('../../src/runtime/navigation.ts')
  await step()('swapping', { phase: 'swapping' })
  expect(start).not.toHaveBeenCalled()
  delete (document as { startViewTransition?: unknown }).startViewTransition
  const { viewTransitions } = await import('../../src/runtime/navigation.ts')
  viewTransitions()
  await expect(step()('swapping', { phase: 'swapping' })).resolves.toBeUndefined()
})

class EntryNavigation extends FakeNavigation {
  currentEntry = { getState: () => ({ from: 'search' }) as unknown }
}

test('searchParams: the current query, as a store; it follows the URL', async () => {
  vi.stubGlobal('location', new URL('http://localhost:3000/search?q=lists&page=2'))
  vi.stubGlobal('navigation', new FakeNavigation())
  const { searchParams, currentUrl } = await import('../../src/runtime/navigation.ts')
  expect(searchParams.get()?.get('q')).toBe('lists')
  currentUrl.set(new URL('http://localhost:3000/search?q=forms'))
  expect(searchParams.get()?.get('q')).toBe('forms')
})

test('setSearch: sets and removes query params on the current URL; replaces the entry unless told otherwise', async () => {
  vi.stubGlobal('location', new URL('http://localhost:3000/search?q=lists&page=2&tag=a#top'))
  const navigation = new FakeNavigation()
  vi.stubGlobal('navigation', navigation)
  const { setSearch } = await import('../../src/runtime/navigation.ts')
  await setSearch({ q: 'forms', page: null, tag: ['a', 'b'], n: 3 })
  await setSearch({ q: 'x' }, { replace: false, state: { k: 1 } })
  expect(navigation.calls).toEqual([
    ['http://localhost:3000/search?q=forms&tag=a&tag=b&n=3#top', { history: 'replace', state: undefined, info: { scroll: false } }],
    ['http://localhost:3000/search?q=x&page=2&tag=a#top', { history: 'auto', state: { k: 1 }, info: { scroll: false } }],
  ])
  // A filter keeps the visitor where they are; scroll: true goes to the top as a new page would.
  await setSearch({ q: 'y' }, { scroll: true })
  expect(navigation.calls.at(-1)![1]).toMatchObject({ info: { scroll: true } })
})

test('navigationState: what navigate(url, { state }) stored, for this entry', async () => {
  vi.stubGlobal('navigation', new EntryNavigation())
  const { navigationState } = await import('../../src/runtime/navigation.ts')
  expect(navigationState()).toEqual({ from: 'search' })
})
