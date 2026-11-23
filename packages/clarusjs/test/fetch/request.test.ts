// @vitest-environment happy-dom
// #431: request(): fetch that throws on non-2xx for any body type, reads the body by its Content-Type (or `as`),
// sends plain objects as JSON, and times out. json() and text() are its shorthands.
import { afterEach, expect, expectTypeOf, test, vi } from 'vitest'
import { json, request, text } from '../../src/fetch/index.ts'

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
const serve = (res: () => Response) => {
  const fn = vi.fn(async (_url: string | URL, _init?: RequestInit) => res())
  vi.stubGlobal('fetch', fn)
  return fn
}
const typed = (body: BodyInit | null, type: string, status = 200) => new Response(body, { status, headers: { 'content-type': type } })

test('reads the body by its Content-Type: JSON (and +json), text (and XML), else a Blob; 204 is undefined', async () => {
  serve(() => typed('{"a":1}', 'application/json; charset=utf-8'))
  expect(await request('/x')).toEqual({ a: 1 })
  serve(() => typed('{"title":"bad"}', 'application/problem+json'))
  expect(await request('/x')).toEqual({ title: 'bad' })
  serve(() => typed('hi', 'text/plain'))
  expect(await request('/x')).toBe('hi')
  serve(() => typed('<a/>', 'application/xml'))
  expect(await request('/x')).toBe('<a/>')
  serve(() => typed(new Uint8Array([1, 2]), 'image/png'))
  const blob = await request('/x')
  expect(blob).toBeInstanceOf(Blob)
  expect((blob as Blob).size).toBe(2)
  serve(() => new Response(null, { status: 204 }))
  expect(await request('/x')).toBeUndefined()
})

test('`as` says what to read, whatever the Content-Type', async () => {
  serve(() => typed('{"a":1}', 'text/plain'))
  expect(await request('/x', { as: 'json' })).toEqual({ a: 1 })
  expect(await request('/x', { as: 'text' })).toBe('{"a":1}')
  expect(new Uint8Array(await request<ArrayBuffer>('/x', { as: 'arrayBuffer' }))[0]).toBe(123)
  const res = await request<Response>('/x', { as: 'response' })
  expect(res).toBeInstanceOf(Response)
  expect(await res.text()).toBe('{"a":1}')
  expect(await request('/x', { as: 'stream' })).toBeInstanceOf(ReadableStream)
  serve(() => new Response(new URLSearchParams({ q: '1' })))
  expect((await request<FormData>('/x', { as: 'formData' })).get('q')).toBe('1')
})

test('a custom parser per Content-Type (without parameters), ahead of the built-in reading', async () => {
  serve(() => typed('{"n":1}\n{"n":2}\n', 'application/x-ndjson; charset=utf-8'))
  const ndjson = async (res: Response) => (await res.text()).trim().split('\n').map((line) => JSON.parse(line))
  expect(await request('/x', { parse: { 'application/x-ndjson': ndjson } })).toEqual([{ n: 1 }, { n: 2 }])
})

test('a non-2xx response throws, for any body type, with status and the body read by the same rules (data)', async () => {
  serve(() => typed('{"errors":{"name":"taken"}}', 'application/json', 422))
  await expect(request('/x')).rejects.toMatchObject({ status: 422, data: { errors: { name: 'taken' } }, message: '/x: 422' })
  serve(() => typed('down', 'text/plain', 503))
  await expect(request('/x', { as: 'blob' })).rejects.toMatchObject({ status: 503, data: 'down' })
  serve(() => new Response('gone', { status: 404, statusText: 'Not Found' }))
  await expect(json('/x')).rejects.toMatchObject({ status: 404, message: '/x: 404 Not Found' })
  await expect(text('/x')).rejects.toMatchObject({ status: 404 })
})

test('a plain object or array body is sent as JSON with its Content-Type; other bodies as fetch takes them', async () => {
  const fn = serve(() => typed('{}', 'application/json'))
  await request('/x', { method: 'POST', body: { name: 'Ada' } })
  let init = fn.mock.calls[0]![1]!
  expect(init.body).toBe('{"name":"Ada"}')
  expect(new Headers(init.headers).get('content-type')).toBe('application/json')
  await request('/x', { method: 'POST', body: [1, 2], headers: { 'content-type': 'application/vnd.x+json' } })
  init = fn.mock.calls[1]![1]!
  expect(init.body).toBe('[1,2]')
  expect(new Headers(init.headers).get('content-type')).toBe('application/vnd.x+json')
  const form = new FormData()
  await request('/x', { method: 'POST', body: form })
  expect(fn.mock.calls[2]![1]!.body).toBe(form)
  await request('/x', { method: 'POST', body: 'raw' })
  expect(fn.mock.calls[3]![1]!.body).toBe('raw')
})

test('json() and text() pass init through to fetch as before (no headers added)', async () => {
  const fn = serve(() => typed('{"ok":1}', 'application/json'))
  const signal = new AbortController().signal
  expect(await json('/good', { signal })).toEqual({ ok: 1 })
  expect(fn.mock.calls[0]![1]).toEqual({ signal })
  serve(() => typed('plain', 'text/plain'))
  expect(await text('/t')).toBe('plain')
})

test('timeout aborts the request with a TimeoutError, combined with the caller\'s signal', async () => {
  vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise((_, reject) => init.signal!.addEventListener('abort', () => reject(init.signal!.reason)))))
  await expect(request('/slow', { timeout: 20 })).rejects.toMatchObject({ name: 'TimeoutError' })
  const c = new AbortController()
  const p = request('/slow', { timeout: 10_000, signal: c.signal })
  c.abort()
  await expect(p).rejects.toMatchObject({ name: 'AbortError' })
})

test('#434 review: a custom parse that throws on an error response still gives the HTTP error (status, no data)', async () => {
  serve(() => typed('x', 'application/x-broken', 500))
  await expect(request('/x', { parse: { 'application/x-broken': () => { throw new Error('parser broke') } } })).rejects.toMatchObject({ status: 500, data: undefined })
})

test('#434 review: `as` gives the result type (text: string, response: Response…); request<T> and parse stay any or T', () => {
  // Types only: never called (a request with as: 'formData' on JSON would reject).
  const types = () => {
    expectTypeOf(request('/x', { as: 'text' })).resolves.toEqualTypeOf<string>()
    expectTypeOf(request('/x', { as: 'blob' })).resolves.toEqualTypeOf<Blob>()
    expectTypeOf(request('/x', { as: 'arrayBuffer' })).resolves.toEqualTypeOf<ArrayBuffer>()
    expectTypeOf(request('/x', { as: 'formData' })).resolves.toEqualTypeOf<FormData>()
    expectTypeOf(request('/x', { as: 'response' })).resolves.toEqualTypeOf<Response>()
    expectTypeOf(request('/x', { as: 'stream' })).resolves.toEqualTypeOf<ReadableStream<Uint8Array> | null>()
    expectTypeOf(request<{ a: number }>('/x')).resolves.toEqualTypeOf<{ a: number }>()
    expectTypeOf(request('/x', { as: 'text', parse: { 'text/plain': () => 1 } })).resolves.toBeAny()
  }
  expect(types).toBeTypeOf('function')
})
