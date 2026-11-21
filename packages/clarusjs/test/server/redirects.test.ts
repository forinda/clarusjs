// #192: a server page's load() can answer with a redirect (or any Response).
import { expect, test } from 'vitest'
import { createHandler, redirect } from '../../src/server/handler.ts'

const page = async () => ({ render: () => '<p>page</p>' })
const h = createHandler(
  { '/src/pages/old.tscl': page, '/src/pages/new.tscl': page, '/src/pages/app/[id].tscl': page },
  {
    modes: { '/old': 'server', '/app/*': 'client' },
    client: { '/app/[id]': '/render/app.js' },
    fragments: true,
    data: {
      '/src/pages/old.load.ts': async () => ({ load: ({ request }: { request: Request }) => redirect(`/new${new URL(request.url).search}`, 301) }),
      '/src/pages/app/[id].load.ts': async () => ({ load: () => redirect('/new') }),
    },
  },
)

test('redirect(): a Response with the status (302 by default) and Location', () => {
  const res = redirect('/x')
  expect(res.status).toBe(302)
  expect(res.headers.get('location')).toBe('/x')
  expect(redirect('/y', 308).status).toBe(308)
})

test('a load() that returns a Response answers with it, for the page, its fragment and its data', async () => {
  for (const path of ['/old?q=1', '/old/index.frag.html?q=1']) {
    const res = await h.fetch(new Request(`http://x${path}`))
    expect(res.status, path).toBe(301)
    expect(res.headers.get('location'), path).toBe('/new?q=1') // the page: a navigator that followed it loads it normally
  }
  const data = await h.fetch(new Request('http://x/app/7/__data.json'))
  expect([data.status, data.headers.get('location')]).toEqual([302, '/new'])
})
