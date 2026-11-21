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

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

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
