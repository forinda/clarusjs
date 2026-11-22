// #93: cookies and locals in every load(), and an optional handle() (src/server.ts) run once per request.
import { describe, expect, test } from 'vitest'
import { createHandler, redirect, type Handle } from '../../src/server/handler.ts'

const page = { render: (p: Record<string, unknown> = {}) => `<p>${JSON.stringify(p)}</p>` }
const make = (load: (c: any) => unknown, handle?: Handle, mode: 'server' | 'client' = 'server', dev = false) => createHandler(
  { '/src/pages/account.tscl': async () => page },
  { data: { '/src/pages/account.load.ts': async () => ({ load: load as never }) }, modes: { '/account': mode }, dev, ...(handle ? { hooks: { handle } } : {}) },
)
const get = (h: ReturnType<typeof make>, url = 'https://x.test/account', headers: Record<string, string> = {}) => h.fetch(new Request(url, { headers }))
const body = async (r: Response) => JSON.parse(/<p>(.*)<\/p>/.exec(await r.text())![1]!)

describe('cookies', () => {
  test('load() reads the request\'s cookies', async () => {
    const h = make(({ cookies }) => ({ theme: cookies.get('theme') ?? null, missing: cookies.get('nope') ?? null, all: cookies.getAll() }))
    const r = await get(h, undefined, { cookie: 'theme=dark; lang=en%20GB' })
    expect(await body(r)).toEqual({ theme: 'dark', missing: null, all: { theme: 'dark', lang: 'en GB' } })
  })

  test('set() adds a Set-Cookie: secure defaults (path /, HttpOnly, SameSite=Lax, Secure)', async () => {
    const h = make(({ cookies }) => { cookies.set('session', 'a b'); return {} })
    expect((await get(h)).headers.get('set-cookie')).toBe('session=a%20b; Path=/; HttpOnly; SameSite=Lax; Secure')
  })

  test('the dev server leaves Secure off (development over plain http); options override the defaults', async () => {
    const h = make(({ cookies }) => {
      cookies.set('a', '1')
      cookies.set('b', '2', { path: '/account', httpOnly: false, sameSite: 'strict', maxAge: 60, domain: 'x.test' })
      return {}
    }, undefined, 'server', true)
    const set = (await get(h, 'http://localhost:5173/account')).headers.getSetCookie()
    expect(set).toEqual(['a=1; Path=/; HttpOnly; SameSite=Lax', 'b=2; Path=/account; Domain=x.test; Max-Age=60; SameSite=Strict'])
  })

  test('outside dev, Secure even when the request looks local (behind a proxy, production can be http://localhost)', async () => {
    const h = make(({ cookies }) => { cookies.set('a', '1'); return {} })
    expect((await get(h, 'http://localhost:3000/account')).headers.get('set-cookie')).toBe('a=1; Path=/; HttpOnly; SameSite=Lax; Secure')
  })

  test('delete() expires it; get() sees this request\'s own writes', async () => {
    const h = make(({ cookies }) => {
      cookies.set('fresh', 'yes')
      cookies.delete('old')
      return { fresh: cookies.get('fresh'), old: cookies.get('old') ?? null }
    })
    const r = await get(h, undefined, { cookie: 'old=1' })
    expect(await body(r)).toEqual({ fresh: 'yes', old: null })
    expect(r.headers.getSetCookie()).toContain('old=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0')
  })

  test('a name that isn\'t a cookie token is refused', async () => {
    const h = make(({ cookies }) => { cookies.set('bad name', 'x'); return {} })
    expect((await get(h)).status).toBe(500)
  })

  test('Set-Cookie goes on a redirect from load() too, and on the page\'s data request', async () => {
    const h = make(({ cookies, request }) => { cookies.set('seen', '1'); return new URL(request.url).searchParams.has('go') ? redirect('/home') : {} })
    const r = await get(h, 'https://x.test/account?go')
    expect(r.status).toBe(302)
    expect(r.headers.get('set-cookie')).toContain('seen=1')
    // A client route's data, fetched by the router.
    const client = make(({ cookies }) => { cookies.set('seen', '1'); return {} }, undefined, 'client')
    const data = await get(client, 'https://x.test/account/__data.json')
    expect(data.headers.get('content-type')).toContain('application/json')
    expect(data.headers.get('set-cookie')).toContain('seen=1')
  })
})

describe('handle() and locals', () => {
  test('handle() runs first and fills locals, which every load() gets', async () => {
    const h = make(({ locals }) => ({ user: locals.user ?? null }), ({ cookies, locals }) => { const id = cookies.get('session'); if (id) (locals as { user?: string }).user = `user-${id}` })
    expect(await body(await get(h, undefined, { cookie: 'session=7' }))).toEqual({ user: 'user-7' })
    expect(await body(await get(h))).toEqual({ user: null })
  })

  test('handle() returning a Response answers instead of the page (a sign-in redirect), with its cookies', async () => {
    let loaded = false
    const h = make(() => { loaded = true; return {} }, ({ cookies, request }) => {
      if (!cookies.get('session')) {
        cookies.set('next', new URL(request.url).pathname)
        return redirect('/login')
      }
    })
    const r = await get(h)
    expect(r.status).toBe(302)
    expect(r.headers.get('location')).toBe('/login')
    expect(r.headers.get('set-cookie')).toContain('next=%2Faccount')
    expect(loaded).toBe(false)
  })

  test('a throwing handle() is a 500, not a crash', async () => {
    const h = make(() => ({}), () => { throw new Error('session store down') })
    expect((await get(h)).status).toBe(500)
  })
})
