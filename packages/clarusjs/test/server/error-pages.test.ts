// #196: a page that fails answers with the site's 500 page (src/pages/500.tscl) and nothing internal; in development
// the error itself is thrown, so the dev server shows it with its stack.
import { afterEach, expect, test, vi } from 'vitest'
import { createHandler } from '../../src/server/handler.ts'

const ok = async () => ({ render: () => '<html><head><title>Ok</title></head><body><p>ok</p></body></html>' })
const broken = async () => ({ render: () => { throw new Error('render exploded') } })
const errorPage = async () => ({ render: (p: { status?: number }) => `<html><head><title>Error</title></head><body><h1>Something broke (${p.status})</h1></body></html>` })
const data = { '/src/pages/data.load.ts': async () => ({ load: () => { throw new Error('db password wrong') } }) }
const log = vi.spyOn(console, 'error').mockImplementation(() => {})
afterEach(() => log.mockClear())

test('a throwing load() or render answers 500 with the 500 page; the details go to the log only', async () => {
  const h = createHandler({ '/src/pages/data.tscl': ok, '/src/pages/broken.tscl': broken, '/src/pages/500.tscl': errorPage }, { data, modes: { '/data': 'server', '/broken': 'server' } })
  for (const [path, detail] of [['/data', 'db password wrong'], ['/broken', 'render exploded']] as const) {
    const res = await h.fetch(new Request(`http://x${path}`))
    expect(res.status, path).toBe(500)
    expect(res.headers.get('content-type'), path).toMatch(/^text\/html/)
    const body = await res.text()
    expect(body, path).toContain('<h1>Something broke (500)</h1>')
    expect(body, path).not.toContain(detail)
    expect(log, path).toHaveBeenCalledWith(expect.stringContaining(detail))
  }
})

test('without a 500 page, or when it fails too, the answer is plain text', async () => {
  const plain = createHandler({ '/src/pages/data.tscl': ok }, { data, modes: { '/data': 'server' } })
  const res = await plain.fetch(new Request('http://x/data'))
  expect([res.status, await res.text()]).toEqual([500, 'Internal Server Error'])
  const both = createHandler({ '/src/pages/broken.tscl': broken, '/src/pages/500.tscl': broken }, { modes: { '/broken': 'server' } })
  const again = await both.fetch(new Request('http://x/broken'))
  expect([again.status, await again.text()]).toEqual([500, 'Internal Server Error'])
})

test('the 500 page itself, at /500, renders with status 200 (like /404), so it can be previewed and prerendered', async () => {
  const h = createHandler({ '/src/pages/500.tscl': errorPage })
  const res = await h.fetch(new Request('http://x/500'))
  expect(res.status).toBe(200)
  expect(await res.text()).toContain('Something broke')
  expect(await h.paths()).toContain('/500')
})

test('in development the error is thrown as it is, for the dev server to show with its stack', async () => {
  const h = createHandler({ '/src/pages/data.tscl': ok, '/src/pages/broken.tscl': broken, '/src/pages/500.tscl': errorPage }, { data, dev: true, modes: { '/data': 'server', '/broken': 'server' } })
  await expect(h.fetch(new Request('http://x/data'))).rejects.toThrow('db password wrong')
  await expect(h.fetch(new Request('http://x/broken'))).rejects.toThrow('render exploded')
})
