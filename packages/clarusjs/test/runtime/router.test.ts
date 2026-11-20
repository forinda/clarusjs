// @vitest-environment happy-dom
// #33: the client router renders client routes in the browser.
import { afterEach, expect, test, vi } from 'vitest'
import { matchRoute, show } from '../../src/runtime/router.ts'
import { stringify } from '../../src/runtime/serialize.ts'

const table = [{ p: '/app', r: '/render/app.js' }, { p: '/app/[id]', r: '/render/app-id.js' }]
afterEach(() => { document.head.innerHTML = ''; document.body.innerHTML = ''; delete (globalThis as { __clAttach?: unknown }).__clAttach })

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
  expect(await show(new URL('http://x/app/7/'), table, load, get)).toBe(true)
  expect(load).toHaveBeenCalledWith('/render/app-id.js')
  expect(get).toHaveBeenCalledWith('/app/7/__data.json')
  expect(document.title).toBe('Item 7')
  expect(document.body.querySelector('h1')!.textContent).toBe('7 1970')
  expect(document.head.querySelector('style')!.textContent).toBe('cl-island{display:contents}')
  expect(attach).toHaveBeenCalledWith(document.body)
})

test('show() leaves other routes alone, and a failed data request is an error', async () => {
  expect(await show(new URL('http://x/elsewhere'), table)).toBe(false)
  const get = async () => new Response('nope', { status: 500 })
  await expect(show(new URL('http://x/app'), table, async () => ({ render: () => '' }), get)).rejects.toThrow('/app/__data.json: 500')
})
