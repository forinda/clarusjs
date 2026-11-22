// #97: a page runs every component loader it uses, in parallel, then renders synchronously with the results.
import { expect, test } from 'vitest'
import { createHandler } from '../../src/server/handler.ts'
import { loaded } from '../../src/runtime/server.ts'

// Stand-ins for compiled components with loaders: each reads its data as a compiled one does.
const stat = (props: Record<string, unknown> = {}) => { const p = { ...loaded('src/components/stat.tscl'), ...props }; return `<b>${p.label}:${p.value}</b>` }
const feed = () => { const p = loaded('src/components/feed.tscl') as { items?: string[] }; return `<ul>${(p.items ?? []).map((i) => `<li>${i}</li>`).join('')}</ul>` }
const page = { render: () => `<main>${stat()}${stat({ label: 'Mine' })}${feed()}</main>` }
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

const make = (mode: 'static' | 'server' | 'client', loaders: Record<string, (c: any) => unknown>, dev = true) => createHandler(
  { '/src/pages/index.tscl': async () => page },
  {
    modes: { '/': mode },
    dev,
    componentLoaders: { '/': Object.keys(loaders) },
    componentData: Object.fromEntries(Object.entries(loaders).map(([file, load]) => [file, async () => ({ load: load as never })])),
  },
)

test('every component loader runs, in parallel, and each component renders with its own data', async () => {
  // How many loaders run at once: both, if they run side by side (one after the other: never more than 1).
  let running = 0
  let most = 0
  const track = async <T>(value: T) => { most = Math.max(most, ++running); await wait(50); running--; return value }
  const h = make('server', {
    '/src/components/stat.load.ts': () => track({ label: 'Visits', value: 12 }),
    '/src/components/feed.load.ts': () => track({ items: ['a', 'b'] }),
  })
  const html = await (await h.fetch(new Request('https://x.test/'))).text()
  expect(most).toBe(2)
  expect(html).toContain('<main><b>Visits:12</b><b>Mine:12</b><ul><li>a</li><li>b</li></ul></main>') // the parent's label wins
})

test('loaders get the route context; a static page\'s can\'t read cookies (#94)', async () => {
  const seen: string[] = []
  const server = make('server', { '/src/components/stat.load.ts': ({ cookies, locals, params }) => { seen.push(`${cookies.get('a')}|${JSON.stringify(locals)}|${JSON.stringify(params)}`); return { label: 'x', value: 1 } } })
  await server.fetch(new Request('https://x.test/', { headers: { cookie: 'a=1' } }))
  expect(seen).toEqual(['1|{}|{}'])
  const fixed = make('static', { '/src/components/stat.load.ts': ({ cookies }) => ({ label: cookies.get('a'), value: 1 }) })
  await expect(fixed.fetch(new Request('https://x.test/'))).rejects.toThrow(/reads cookies, but static routes are built once/)
})

test('a failing loader fails the page, naming the loader; it must return an object', async () => {
  const failing = make('server', { '/src/components/stat.load.ts': () => { throw new Error('db down') } })
  await expect(failing.fetch(new Request('https://x.test/'))).rejects.toThrow('src/components/stat.load.ts: load() failed: db down')
  const wrong = make('server', { '/src/components/stat.load.ts': () => 'nope' })
  await expect(wrong.fetch(new Request('https://x.test/'))).rejects.toThrow(/stat\.load\.ts: load\(\) must return an object/)
  expect((await make('server', { '/src/components/stat.load.ts': () => { throw new Error('x') } }, false).fetch(new Request('https://x.test/'))).status).toBe(500)
})

test('a client route can\'t use component loaders yet: a clear error', async () => {
  const h = make('client', { '/src/components/stat.load.ts': () => ({}) })
  await expect(h.fetch(new Request('https://x.test/'))).rejects.toThrow(/component loaders don't run in client routes/)
})
