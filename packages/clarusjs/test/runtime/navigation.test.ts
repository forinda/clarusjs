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
    ['/guide/lists', { history: 'auto', state: undefined }],
    ['http://localhost:3000/guide/holes', { history: 'replace', state: { from: 'search' } }],
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
