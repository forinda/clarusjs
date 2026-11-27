// @vitest-environment happy-dom
// #33: the client router renders client routes in the browser.
import { afterEach, expect, test, vi } from 'vitest'
import { matchRoute, show, swapIn } from '../../src/runtime/router.ts'
import { stringify } from '../../src/runtime/serialize.ts'

// The shell's route table element: the server always sets data-title (the title template, '%s' without one).
// Added after the router module loads, so the router doesn't start on its own here.
const shell = Object.assign(document.createElement('script'), { id: 'cl-routes' })
shell.dataset.title = '%s'
document.head.append(shell)

const table = [{ p: '/app', r: '/render/app.js' }, { p: '/app/[id]', r: '/render/app-id.js' }]
afterEach(() => { document.head.innerHTML = ''; document.head.append(shell); document.body.innerHTML = ''; delete (globalThis as { __clAttach?: unknown }).__clAttach })

test('matchRoute: same grammar as the server; trailing slash and %-escapes handled', () => {
  expect(matchRoute(table, '/app')).toEqual({ r: '/render/app.js', params: {} })
  expect(matchRoute(table, '/app/a%20b/')).toEqual({ r: '/render/app-id.js', params: { id: 'a b' } })
  expect(matchRoute(table, '/app/1/2')).toBeNull()
  expect(matchRoute(table, '/other')).toBeNull()
  expect(matchRoute(table, '/app/%E0%A4%A')).toBeNull()
})

test('show() loads the render module and the data, swaps the document, and attaches islands', async () => {
  const attach = vi.fn()
  ;(globalThis as { __clAttach?: unknown }).__clAttach = attach
  const load = vi.fn(async () => ({ render: (p: { id: string; when: Date }) => `<!doctype html><html><head><title>Item ${p.id}</title></head><body><h1>${p.id} ${p.when.getUTCFullYear()}</h1><cl-island c="x"></cl-island></body></html>` }))
  const get = vi.fn(async () => new Response(stringify({ id: '7', when: new Date(0) })))
  expect(await show(new URL('http://x/app/7/'), table, undefined, load, get)).toBe(true)
  expect(load).toHaveBeenCalledWith('/render/app-id.js')
  expect(get).toHaveBeenCalledWith('/app/7/__data.json')
  expect(document.title).toBe('Item 7')
  expect(document.body.querySelector('h1')!.textContent).toBe('7 1970')
  expect(attach).toHaveBeenCalledWith(document.body, 1) // navigated: focus and announce (loader)
})

test('show() leaves other routes alone, and a failed data request is an error', async () => {
  expect(await show(new URL('http://x/elsewhere'), table)).toBe(false)
  const get = async () => new Response('nope', { status: 500 })
  await expect(show(new URL('http://x/app'), table, undefined, async () => ({ render: () => '' }), get)).rejects.toThrow('500 /app/__data.json')
})

test('review: the rendered <html> attributes replace the old ones (lang, dir)', async () => {
  document.documentElement.setAttribute('data-old', 'x')
  const load = async () => ({ render: () => '<html lang="ar" dir="rtl"><head><title>t</title></head><body><p>x</p></body></html>' })
  await show(new URL('http://x/app'), table, undefined, load, async () => new Response('{}'))
  expect(document.documentElement.getAttribute('lang')).toBe('ar')
  expect(document.documentElement.getAttribute('dir')).toBe('rtl')
  expect(document.documentElement.hasAttribute('data-old')).toBe(false)
  await show(new URL('http://x/app'), table, undefined, async () => ({ render: () => '<html lang="en"><body></body></html>' }), async () => new Response('{}'))
  expect(document.documentElement.getAttribute('lang')).toBe('en')
  expect(document.documentElement.hasAttribute('dir')).toBe(false)
})

test('review: a navigation that is no longer current never touches the document', async () => {
  let current = 'second'
  const slow = show(new URL('http://x/app/1'), table, () => current === 'first', async () => {
    await new Promise((r) => setTimeout(r, 20))
    return { render: () => '<p>first</p>' }
  }, async () => new Response('{}'))
  await show(new URL('http://x/app/2'), table, () => current === 'second', async () => ({ render: () => '<p>second</p>' }), async () => new Response('{}'))
  expect(await slow).toBe(false)
  expect(document.body.textContent).toBe('second')
})

test('review: a missing page (404 data) is reported as not found', async () => {
  const get = async () => new Response('Not Found', { status: 404 })
  await expect(show(new URL('http://x/app/9'), table, undefined, async () => ({ render: () => '' }), get)).rejects.toThrow(/^404 \/app\/9\/__data\.json$/)
})

test('review: under a base, the route table holds browser paths and data stays under the base', async () => {
  const based = [{ p: '/docs/app/[id]', r: '/docs/r.js' }]
  const get = vi.fn(async () => new Response('{}'))
  expect(await show(new URL('http://x/docs/app/7'), based, undefined, async () => ({ render: () => '<p>ok</p>' }), get)).toBe(true)
  expect(get).toHaveBeenCalledWith('/docs/app/7/__data.json')
})

test('#40: the router keeps the head (its stylesheets stay); it updates the title and runs the inline head scripts once', async () => {
  document.head.innerHTML = '<link rel="stylesheet" href="/site.css"><title>Old</title>'
  document.head.append(shell)
  const render = () => '<html><head><title>New</title><script>window.__ran = 1</script></head><body><p>x</p></body></html>'
  await show(new URL('http://x/app'), table, undefined, async () => ({ render }), async () => new Response('{}'))
  expect(document.title).toBe('New')
  expect(document.head.querySelector('link[href="/site.css"]')).not.toBeNull()
  expect(document.head.querySelectorAll('script:not(#cl-routes)')).toHaveLength(0) // run once, then removed (Playwright checks they run)
})

test('show() applies the title template the shell carries on #cl-routes', async () => {
  shell.dataset.title = '%s · Site'
  await show(new URL('http://x/app'), table, undefined, async () => ({ render: () => '<html><head><title>Page</title></head><body></body></html>' }), async () => new Response('{}'))
  expect(document.title).toBe('Page · Site')
  shell.dataset.title = '%s'
})

test('#192: a redirected __data.json request (the server sent the page) is an error: the page then loads normally', async () => {
  const html = async () => new Response('<!doctype html><html><body><p>moved</p></body></html>', { headers: { 'content-type': 'text/html' } })
  await expect(show(new URL('http://x/app'), table, undefined, async () => ({ render: () => '<p>x</p>' }), html)).rejects.toThrow()
})

test('#196: swapIn() puts a whole page in: body, <html> attributes, title, islands (inline scripts: e2e)', async () => {
  const attach = vi.fn()
  ;(globalThis as { __clAttach?: unknown }).__clAttach = attach
  await swapIn('<html lang="en"><head><title>Page not found · Site</title></head><body><h1>Gone</h1></body></html>')
  expect(document.title).toBe('Page not found · Site') // as written; show() passes the title template
  expect(document.documentElement.lang).toBe('en')
  expect(document.body.innerHTML).toBe('<h1>Gone</h1>')
  expect(attach).toHaveBeenCalledWith(document.body, 1)
})

test('review (#186): show() resolves once the new page\'s islands that attach right away are attached', async () => {
  let attached = false
  ;(globalThis as { __clAttach?: unknown }).__clAttach = () => new Promise<void>((r) => setTimeout(() => { attached = true; r() }, 10))
  await show(new URL('http://x/app'), table, undefined, async () => ({ render: () => '<p>x</p>' }), async () => new Response('{}'))
  expect(attached).toBe(true)
})

test('swapIn runs a page\'s inline scripts, never its data (JSON-LD, JSON): those aren\'t JavaScript', async () => {
  // happy-dom doesn't run scripts: what the router appends to run them is checked (Playwright checks they run)
  const appended: [string, string][] = []
  const append = vi.spyOn(document.head, 'append').mockImplementation((...nodes) => {
    for (const n of nodes) if (n instanceof HTMLScriptElement) appended.push([n.type, n.textContent ?? ''])
  })
  await swapIn('<html><head><title>T</title>'
    + '<script>run("plain")</script>'
    + '<script type="module">run("module")</script>'
    + '<script type="application/ld+json">{"@context":"https://schema.org","name":"x"}</script>'
    + '<script type="application/json" id="data">{"a":1}</script>'
    + '</head><body><p>x</p></body></html>')
  append.mockRestore()
  expect(appended).toEqual([['', 'run("plain")'], ['module', 'run("module")']])
})
