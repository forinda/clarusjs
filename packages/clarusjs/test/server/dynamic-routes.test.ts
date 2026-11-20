// #30: dynamic routes. src/pages/users/[id].tscl renders /users/<anything>, with the parameter as an input.
import { expect, test } from 'vitest'
import { createHandler, routeFromFile } from '../../src/server/handler.ts'

const echo = (name: string) => async () => ({ render: (p: Record<string, string> = {}) => `<p>${name} ${JSON.stringify(p)}</p>` })
const text = async (h: ReturnType<typeof createHandler>, path: string) => {
  const res = await h.fetch(new Request(`http://x${path}`))
  return res.status === 200 ? (await res.text()).replace(/^.*<body>|<\/body>.*$/g, '') : res.status
}

test('routeFromFile keeps [param] segments', () => {
  expect(routeFromFile('/src/pages/users/[id].tscl')).toBe('/users/[id]')
  expect(routeFromFile('/src/pages/[lang]/docs/[page].tscl')).toBe('/[lang]/docs/[page]')
  expect(routeFromFile('/src/pages/blog/[slug]/index.tscl')).toBe('/blog/[slug]')
})

test('a dynamic route renders with its parameters as inputs; a static route wins', async () => {
  const h = createHandler({
    '/src/pages/users/[id].tscl': echo('user'),
    '/src/pages/users/new.tscl': echo('new'),
    '/src/pages/[lang]/docs/[page].tscl': echo('doc'),
  })
  expect(await text(h, '/users/42')).toBe('<p>user {"id":"42"}</p>')
  expect(await text(h, '/users/42/')).toBe('<p>user {"id":"42"}</p>')
  expect(await text(h, '/users/new')).toBe('<p>new {}</p>')
  expect(await text(h, '/users/a%20b')).toBe('<p>user {"id":"a b"}</p>')
  expect(await text(h, '/fr/docs/intro')).toBe('<p>doc {"lang":"fr","page":"intro"}</p>')
  expect(await text(h, '/users')).toBe(404)
  expect(await text(h, '/users/1/2')).toBe(404)
  expect(await text(h, '/users/%E0%A4%A')).toBe(404) // malformed escape: not a page, not a crash
})

test('paths() lists every page to prerender, using entries() for dynamic routes', async () => {
  const h = createHandler(
    { '/src/pages/index.tscl': echo('home'), '/src/pages/users/[id].tscl': echo('user') },
    { data: { '/src/pages/users/[id].load.ts': async () => ({ entries: async () => [{ id: 'ada' }, { id: 'a b' }] }) } },
  )
  expect(await h.paths()).toEqual(['/', '/users/a%20b', '/users/ada'])
})

test('a dynamic route without entries(), or with unsafe values, is an error that names the file', async () => {
  const missing = createHandler({ '/src/pages/users/[id].tscl': echo('user') })
  await expect(missing.paths()).rejects.toThrow('/users/[id] is a dynamic route: export entries() from src/pages/users/[id].load.ts to list the pages to prerender')
  for (const bad of [{ id: '..' }, { id: 'a/b' }, { id: '' }, { id: 1 }, {}]) {
    const h = createHandler({ '/src/pages/users/[id].tscl': echo('user') }, { data: { '/src/pages/users/[id].load.ts': async () => ({ entries: () => [bad] as unknown as Record<string, string>[] }) } })
    await expect(h.paths(), JSON.stringify(bad)).rejects.toThrow(/^src\/pages\/users\/\[id\]\.load\.ts: entries\(\) gave .* for "id"/)
  }
})

test('review: matching and expansion share one parameter grammar ([$id] works; v[2] is literal)', async () => {
  const h = createHandler(
    { '/src/pages/users/[$id].tscl': echo('user'), '/src/pages/v[2]/x.tscl': echo('lit') },
    { data: { '/src/pages/users/[$id].load.ts': async () => ({ entries: () => [{ $id: 'ada' }] }) } },
  )
  expect(await text(h, '/users/ada')).toBe('<p>user {"$id":"ada"}</p>')
  expect(await text(h, '/v[2]/x')).toBe('<p>lit {}</p>')
  expect(await h.paths()).toEqual(['/users/ada', '/v[2]/x'])
  const empty = createHandler({ '/src/pages/users/[$id].tscl': echo('user') }, { data: { '/src/pages/users/[$id].load.ts': async () => ({ entries: () => [{ $id: '' }] }) } })
  await expect(empty.paths()).rejects.toThrow(/entries\(\) gave "" for "\$id"/)
})
