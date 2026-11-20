// @vitest-environment happy-dom
// #36: fragment navigation swaps the page's region, keeps persisted elements, and lets islands attach.
import { afterEach, expect, test, vi } from 'vitest'
import { fragmentUrl, swap } from '../../src/runtime/fragments.ts'

afterEach(() => { document.head.innerHTML = ''; document.body.innerHTML = ''; delete (globalThis as { __clAttach?: unknown }).__clAttach })

test('fragmentUrl: <path>/index.frag.html, keeping the query', () => {
  expect(fragmentUrl(new URL('http://x/'))).toBe('/index.frag.html')
  expect(fragmentUrl(new URL('http://x/guide/lists/'))).toBe('/guide/lists/index.frag.html')
  expect(fragmentUrl(new URL('http://x/playground?name=a'))).toBe('/playground/index.frag.html?name=a')
})

test('swap() replaces the region, updates the title, keeps persisted elements, and attaches islands', async () => {
  document.body.innerHTML = '<header><span data-cl-persist="theme"><button id="t">dark</button></span></header><main data-cl-swap><h1>Old</h1></main><footer>f</footer>'
  const kept = document.getElementById('t')
  const attach = vi.fn()
  ;(globalThis as { __clAttach?: unknown }).__clAttach = attach
  const get = vi.fn(async () => new Response('<title>New page</title><main data-cl-swap><h1>New</h1><span data-cl-persist="theme"><button id="t">system</button></span></main>'))
  await swap(new URL('http://x/next'), get)
  expect(get).toHaveBeenCalledWith('/next/index.frag.html')
  expect(document.title).toBe('New page')
  expect(document.querySelector('main h1')!.textContent).toBe('New')
  expect(document.querySelector('footer')!.textContent).toBe('f') // outside the region: untouched
  expect(document.getElementById('t')).toBe(kept) // the very same element, moved in
  expect(kept!.textContent).toBe('dark')
  expect(attach).toHaveBeenCalledWith(document.querySelector('main'))
})

test('without a marked region the body is swapped', async () => {
  document.body.innerHTML = '<h1>Old</h1>'
  await swap(new URL('http://x/b'), async () => new Response('<title>B</title><body class="b"><h1>B</h1></body>'))
  expect(document.body.innerHTML).toBe('<h1>B</h1>')
  expect(document.body.className).toBe('b')
})

test('a failed fragment request is an error (the caller falls back to a normal load); stale swaps do nothing', async () => {
  await expect(swap(new URL('http://x/nope'), async () => new Response('', { status: 404 }))).rejects.toThrow('404: /nope/index.frag.html')
  document.body.innerHTML = '<h1>Current</h1>'
  await swap(new URL('http://x/old'), async () => new Response('<title>Old</title><body><h1>Old</h1></body>'), () => false)
  expect(document.body.innerHTML).toBe('<h1>Current</h1>')
})
