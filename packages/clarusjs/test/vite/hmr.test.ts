// #53: in dev, a changed island swaps itself in place; a change only the server sees (a page, a layout, a stateless
// component) reloads the browser. Builds carry none of it.
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { createBuilder, createServer, type HotPayload, type ViteDevServer } from 'vite'
import { afterAll, beforeAll, expect, test } from 'vitest'
import clarusjs from '../../src/vite/plugin.ts'

const quiet = { info() {}, warn() {}, warnOnce() {}, error() {}, clearScreen() {}, hasErrorLogged: () => false, hasWarned: false }

function app(): { root: string; w: (path: string, text: string) => void } {
  const root = mkdtempSync(resolve(tmpdir(), 'clarus-hmr-'))
  const w = (path: string, text: string) => { mkdirSync(resolve(root, path, '..'), { recursive: true }); writeFileSync(resolve(root, path), text) }
  w('src/components/counter.tscl', '<script>\n  let count = state(0)\n</script>\n<button (click)="count++">{{ count }}</button>\n')
  w('src/components/note.tscl', '<p>note</p>\n')
  w('src/pages/index.tscl', "@import counter from '../components/counter.tscl'\n@import note from '../components/note.tscl'\n<h1>Home</h1>\n<note />\n<counter />\n")
  mkdirSync(resolve(root, 'node_modules'))
  symlinkSync(resolve(import.meta.dirname, '../..'), resolve(root, 'node_modules/clarusjs'), 'junction')
  return { root, w }
}

let server: ViteDevServer
let base: string
let sent: HotPayload[]
let dev: ReturnType<typeof app>

beforeAll(async () => {
  dev = app()
  server = await createServer({ root: dev.root, configFile: false, customLogger: quiet, plugins: [clarusjs()], server: { port: 0 } })
  await server.listen()
  const address = server.httpServer!.address()
  base = `http://localhost:${typeof address === 'object' && address ? address.port : 0}`
  sent = []
  const client = server.environments.client.hot
  const send = client.send.bind(client)
  client.send = ((payload: HotPayload) => { sent.push(payload); send(payload) }) as typeof client.send
})
afterAll(async () => { await server?.close() })

const until = async (ok: () => boolean) => { for (let i = 0; i < 100 && !ok(); i++) await new Promise((r) => setTimeout(r, 50)) }

test("an island's dev module accepts its own updates and swaps itself in through the hot runtime", async () => {
  const js = await (await fetch(`${base}/src/components/counter.tscl?import`)).text()
  expect(js).toContain('import.meta.hot.accept()')
  expect(js).toContain('__cl_root.__cl_hot = () => ({ count: count.get() })')
  const hot = /import \{ swap as __cl_swap \} from "([^"]+)"/.exec(js)?.[1]
  expect(hot).toBeTruthy()
  const runtime = await fetch(base + hot)
  expect(runtime.status).toBe(200)
  expect(await runtime.text()).toContain('export async function swap')
})

test('a change only the server sees reloads the browser; a change to an island the browser has loaded does not', async () => {
  await fetch(`${base}/`) // the page and its components are in the server's module graph
  await fetch(`${base}/src/components/counter.tscl?import`) // and the island in the browser's
  sent.length = 0
  dev.w('src/components/note.tscl', '<p>changed</p>\n')
  await until(() => sent.some((p) => p.type === 'full-reload'))
  expect(sent).toContainEqual(expect.objectContaining({ type: 'full-reload' }))

  sent.length = 0
  dev.w('src/components/counter.tscl', '<script>\n  let count = state(0)\n</script>\n<button (click)="count++">n = {{ count }}</button>\n')
  await until(() => sent.some((p) => p.type === 'update'))
  expect(sent.some((p) => p.type === 'update')).toBe(true)
  expect(sent.some((p) => p.type === 'full-reload')).toBe(false)
}, 20_000)

test('vite build: no hot code in the island chunks', async () => {
  const { root } = app()
  const env = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'
  try {
    await (await createBuilder({ root, configFile: false, customLogger: quiet, plugins: [clarusjs()] })).buildApp()
  } finally {
    process.env.NODE_ENV = env
  }
  const dir = resolve(root, 'dist/client/assets')
  const js = (readdirSync(dir, { recursive: true }) as string[]).filter((f) => f.endsWith('.js')).map((f) => readFileSync(resolve(dir, f), 'utf8')).join('\n')
  expect(js).toContain('attach')
  expect(js).not.toContain('__cl_hot')
  expect(js).not.toContain('could not be swapped')
}, 60_000)
