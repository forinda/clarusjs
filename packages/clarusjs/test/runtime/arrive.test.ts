// @vitest-environment happy-dom
// #121: after a fragment swap or client render, focus moves to the new content and the title is announced.
import { afterEach, expect, test, vi } from 'vitest'
import '../../src/runtime/loader.ts'

const navigated = (root: ParentNode) => (globalThis as { __clAttach?: (root: ParentNode, navigated?: 1) => void }).__clAttach!(root, 1)
afterEach(() => { document.body.innerHTML = ''; history.replaceState(null, '', '/'); vi.useRealTimers() })

test('focus goes to the page heading, which can take focus without becoming a tab stop', () => {
  document.body.innerHTML = '<header><a href="/">x</a></header><main id="content"><h1>New page</h1><p>…</p></main>'
  navigated(document.body)
  const h1 = document.querySelector('h1')!
  expect(document.activeElement).toBe(h1)
  expect(h1.getAttribute('tabindex')).toBe('-1')
})

test('without a heading, focus goes to <main>; with a #hash, to its target', () => {
  document.body.innerHTML = '<main><p>no heading</p></main>'
  navigated(document.body)
  expect(document.activeElement).toBe(document.querySelector('main'))
  history.replaceState(null, '', '/page#install')
  document.body.innerHTML = '<main><h1>T</h1><h2 id="install">Install</h2></main>'
  navigated(document.body)
  expect(document.activeElement).toBe(document.getElementById('install'))
})

test('the new title is announced in one polite live region, kept across navigations', async () => {
  vi.useFakeTimers()
  document.title = 'First · Site'
  document.body.innerHTML = '<main><h1>First</h1></main>'
  navigated(document.body)
  const live = document.querySelector('[aria-live="polite"]')!
  vi.runAllTimers()
  expect(live.textContent).toBe('First · Site')
  document.title = 'Second · Site'
  navigated(document.body)
  vi.runAllTimers()
  expect(document.querySelectorAll('[aria-live]')).toHaveLength(1)
  expect(live.textContent).toBe('Second · Site')
})

test('a plain attach (initial load, an @if branch) moves nothing and announces nothing', () => {
  document.body.innerHTML = '<main><h1>Page</h1></main>'
  ;(globalThis as { __clAttach?: (root: ParentNode) => void }).__clAttach!(document.body)
  expect(document.activeElement).not.toBe(document.querySelector('h1'))
  expect(document.querySelector('[aria-live]')).toBeNull()
})

test('review: the new page heading in <main> wins over a heading kept in the shell', () => {
  document.body.innerHTML = '<header><h1>Brand</h1></header><main><h1>Page</h1></main>'
  navigated(document.body)
  expect(document.activeElement).toBe(document.querySelector('main h1'))
})

test('review: a #hash target that reports tabIndex 0 but cannot take focus (<a> without href) still gets focus', () => {
  history.replaceState(null, '', '/page#install')
  document.body.innerHTML = '<main><h1>T</h1><a id="install">Install</a></main>'
  navigated(document.body)
  expect(document.activeElement).toBe(document.getElementById('install'))
  expect(document.getElementById('install')!.getAttribute('tabindex')).toBe('-1') // what makes it focusable in browsers
})

test('review: a natively focusable target keeps its tab order (no tabindex added)', () => {
  history.replaceState(null, '', '/page#go')
  document.body.innerHTML = '<main><h1>T</h1><a id="go" href="/x">Go</a></main>'
  navigated(document.body)
  expect(document.activeElement).toBe(document.getElementById('go'))
  expect(document.getElementById('go')!.hasAttribute('tabindex')).toBe(false)
})
