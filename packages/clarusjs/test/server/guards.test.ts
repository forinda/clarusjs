// #457: folder guards. src/pages/**/+guard.ts runs before the page's load() for every route under its folder (outer
// folders first); a Response is the answer, nothing goes on. Endpoints under the folder too.
import { expect, test } from 'vitest'
import { createHandler } from '../../src/server/handler.ts'

const order: string[] = []
const h = createHandler(
  {
    '/src/pages/index.tscl': async () => ({ render: () => '<h1>home</h1>' }),
    '/src/pages/admin/index.tscl': async () => ({ render: (p: any) => `<h1>admin ${p.who}</h1>` }),
    '/src/pages/admin/sign-in.tscl': async () => ({ render: () => '<h1>sign in</h1>' }),
    '/src/pages/admin/users/[id].tscl': async () => ({ render: (p: any) => `<h1>user ${p.id}</h1>` }),
  },
  {
    modes: { '/admin/*': 'server' },
    data: { '/src/pages/admin/index.load.ts': async () => ({ load: ({ locals }: any) => { order.push('load'); return { who: locals.who } } }) },
    guards: {
      '/src/pages/admin/+guard.ts': async () => ({
        guard: ({ cookies, url, locals }: any) => {
          order.push('admin')
          if (url.pathname === '/admin/sign-in') return
          if (!cookies.get('user')) return new Response(null, { status: 303, headers: { location: '/admin/sign-in?next=' + encodeURIComponent(url.pathname) } })
          locals.who = cookies.get('user')
        },
      }),
      '/src/pages/admin/users/+guard.ts': async () => ({
        guard: ({ params, locals }: any) => { order.push('users'); if (params.id === '0') return new Response('no', { status: 403 }); locals.seen = true },
      }),
    },
    endpoints: { '/src/pages/admin/api.ts': async () => ({ GET: ({ locals }: any) => Response.json({ who: locals.who }) }) },
  },
)
const call = (path: string, cookie = '') => h.fetch(new Request(`https://x.test${path}`, { headers: cookie ? { cookie } : {} }))

test('a guard answers with its Response instead of the page: a redirect when signed out', async () => {
  const r = await call('/admin')
  expect(r.status).toBe(303)
  expect(r.headers.get('location')).toBe('/admin/sign-in?next=%2Fadmin')
})

test('returning nothing goes on; it runs before load() and can set locals', async () => {
  order.length = 0
  const r = await call('/admin', 'user=ada')
  expect(await r.text()).toContain('<h1>admin ada</h1>')
  expect(order).toEqual(['admin', 'load'])
})

test('outer folders\' guards first, then inner; any of them can answer', async () => {
  order.length = 0
  expect(await (await call('/admin/users/7', 'user=ada')).text()).toContain('<h1>user 7</h1>')
  expect(order).toEqual(['admin', 'users'])
  expect((await call('/admin/users/0', 'user=ada')).status).toBe(403)
  expect((await call('/admin/users/7')).status).toBe(303) // the outer guard answered first
})

test('routes outside the folder are not guarded; endpoints under it are', async () => {
  expect(await (await call('/')).text()).toContain('<h1>home</h1>')
  expect((await call('/admin/api')).status).toBe(303)
  expect(await (await call('/admin/api', 'user=ada')).json()).toEqual({ who: 'ada' })
})

test('a guard that throws is a located 500', async () => {
  const bad = createHandler({ '/src/pages/a/index.tscl': async () => ({ render: () => 'a' }) }, {
    guards: { '/src/pages/a/+guard.ts': async () => ({ guard: () => { throw new Error('boom') } }) },
  })
  const r = await bad.fetch(new Request('https://x.test/a'))
  expect(r.status).toBe(500)
})
