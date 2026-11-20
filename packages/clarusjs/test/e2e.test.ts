import { afterAll, beforeAll, expect, test } from 'vitest'
import { createServer, type ViteDevServer } from 'vite'

const root = `${import.meta.dirname}/../../../examples/counter`
let server: ViteDevServer
let base: string

beforeAll(async () => {
  server = await createServer({ root, configFile: `${root}/vite.config.ts`, logLevel: 'silent', server: { port: 0 } })
  await server.listen()
  const address = server.httpServer!.address()
  base = `http://localhost:${typeof address === 'object' && address ? address.port : 0}`
})
afterAll(async () => { await server?.close() })

test('page is server-rendered with the counters as the only islands', async () => {
  const res = await fetch(`${base}/`)
  expect(res.status).toBe(200)
  const html = await res.text()
  expect(html).toContain('<h1>clarusjs POC</h1>')
  expect(html).toContain('<p>Hello, world!</p>')
  expect(html.match(/<cl-island c="counter"/g)).toHaveLength(2)
  expect(html.match(/<script/g)).toHaveLength(1)
})

test('loader is served as JS', async () => {
  const res = await fetch(`${base}/cl-loader.js`)
  expect(res.status).toBe(200)
  expect(res.headers.get('content-type')).toContain('javascript')
})

test('island chunk is the client attach module, with no server code', async () => {
  const html = await (await fetch(`${base}/`)).text()
  const src = html.match(/<cl-island c="counter" src="([^"]+)"/)![1]!
  const res = await fetch(base + src)
  expect(res.status).toBe(200)
  const js = await res.text()
  expect(js).toContain('export function attach')
  expect(js).not.toContain('render')
})

test('stateless component ships no code to the client', async () => {
  const res = await fetch(`${base}/src/components/greeting.tscl?import`)
  expect(res.status).toBe(200)
  expect(res.headers.get('content-type')).toContain('javascript')
  const js = await res.text()
  expect(js).not.toContain('Hello')
  expect(js).not.toContain('render')
})

test('unknown path is 404', async () => {
  expect((await fetch(`${base}/nope`)).status).toBe(404)
})
