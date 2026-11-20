// #33: client routes. The server sends a shell; the browser renders the page from its render module and its data.
import { expect, test } from 'vitest'
import { createHandler } from '../../src/server/handler.ts'
import { checkModes } from '../../src/server/modes.ts'
import { parse } from '../../src/runtime/serialize.ts'
import { routeToFile } from '../../src/vite/build.ts'

const page = async () => ({ render: (p: Record<string, unknown> = {}) => `<p>${JSON.stringify(p)}</p>` })
const handler = () => createHandler(
  { '/src/pages/index.tscl': page, '/src/pages/app/[id].tscl': page, '/src/pages/app/index.tscl': page },
  {
    modes: { '/app/*': 'client' },
    loaderUrl: '/l.js',
    routerUrl: '/r.js',
    client: { '/app': '/render/app.js', '/app/[id]': '/render/app-id.js' },
    data: {
      '/src/pages/app/[id].load.ts': async () => ({
        entries: () => [{ id: '1' }],
        load: ({ params }: { params: Record<string, string> }) => ({ when: new Date(0), tag: `</script>${params.id}` }),
      }),
    },
  },
)

test("'client' is a known mode now", () => {
  expect(() => checkModes({ '/app/*': 'client' })).not.toThrow()
})

test('a client route answers with a shell: the loader, the router and the client route table, nothing rendered', async () => {
  const res = await handler().fetch(new Request('http://x/app/1'))
  expect(res.status).toBe(200)
  const html = await res.text()
  expect(html).toContain('<script type="module" src="/l.js"></script><script type="module" src="/r.js"></script>')
  expect(html).not.toContain('<p>')
  const table = JSON.parse(/<script type="application\/json" id="cl-routes">(.*?)<\/script>/.exec(html)![1]!)
  expect(table).toEqual([{ p: '/app', r: '/render/app.js' }, { p: '/app/[id]', r: '/render/app-id.js' }])
})

test('its data is served as <path>/__data.json: params plus load(), JSON with tags, safe to embed', async () => {
  const res = await handler().fetch(new Request('http://x/app/1/__data.json'))
  expect(res.status).toBe(200)
  expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8')
  const text = await res.text()
  expect(text).not.toContain('</script>')
  expect(parse(text)).toEqual({ id: '1', when: new Date(0), tag: '</script>1' })
  expect((await (await handler().fetch(new Request('http://x/app/__data.json'))).text())).toBe('{}')
  expect((await handler().fetch(new Request('http://x/index/__data.json'))).status).toBe(404) // only client routes
})

test('prerendering writes each client page shell and its data file', async () => {
  expect(await handler().paths()).toEqual(['/', '/app', '/app/1', '/app/1/__data.json', '/app/__data.json'])
  expect(routeToFile('/app/1/__data.json')).toBe('app/1/__data.json')
  expect(routeToFile('/__data.json')).toBe('__data.json')
})

test('review: <path>/__data.json is only a data request for a client route; reserved as an entries() value', async () => {
  const echo = async () => ({ render: (p: Record<string, unknown> = {}) => `<p>${JSON.stringify(p)}</p>` })
  const h = createHandler({ '/src/pages/account/[id].tscl': echo }, { modes: { '/account/*': 'server' } })
  const res = await h.fetch(new Request('http://x/account/__data.json'))
  expect(res.status).toBe(200)
  expect(await res.text()).toContain('{"id":"__data.json"}')
  const bad = createHandler({ '/src/pages/app/[id].tscl': echo }, { modes: { '/app/*': 'client' }, data: { '/src/pages/app/[id].load.ts': async () => ({ entries: () => [{ id: '__data.json' }] }) } })
  await expect(bad.paths()).rejects.toThrow(/entries\(\) gave "__data.json" for "id"/)
})

test('review: a prerendered dynamic route only answers for the pages its entries() lists, as on a static host', async () => {
  const h = handler()
  expect((await h.fetch(new Request('http://x/app/1'))).status).toBe(200)
  expect((await h.fetch(new Request('http://x/app/9'))).status).toBe(404)
  expect((await h.fetch(new Request('http://x/app/9/__data.json'))).status).toBe(404)
})
