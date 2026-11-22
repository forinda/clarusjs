// #51: an MCP server agents use to check their clarusjs work: check, explain, compile and docs search.
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { expect, test } from 'vitest'
import { createMcp } from '../src/mcp.ts'

const workspace = resolve(import.meta.dirname, '../../..')
const DOCS = `# clarusjs

> A compiler for .tscl components.

---

Source: https://clarusjs.com/guide/islands

# Islands

A component with a script is an island.

## Editing an island

In vite dev, saving an island swaps it in place and keeps its state.

---

Source: https://clarusjs.com/guide/lists

# Lists

## Keys

@for needs track: rows are matched by key, so an island row keeps its state when the list is reordered.
`

function project(files: Record<string, string>): string {
  const root = mkdtempSync(resolve(tmpdir(), 'clarus-mcp-'))
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(dirname(resolve(root, file)), { recursive: true })
    writeFileSync(resolve(root, file), text)
  }
  mkdirSync(resolve(root, 'node_modules'))
  symlinkSync(resolve(workspace, 'packages/clarusjs'), resolve(root, 'node_modules/clarusjs'), 'junction')
  symlinkSync(resolve(workspace, 'packages/clarusjs/node_modules/typescript'), resolve(root, 'node_modules/typescript'), 'junction')
  return root
}

let fetches = 0
const fakeFetch = (async () => { fetches++; return new Response(DOCS) }) as typeof fetch
const mcp = (cwd = workspace) => createMcp({ cwd, fetch: fakeFetch, cacheDir: mkdtempSync(resolve(tmpdir(), 'clarus-mcp-cache-')) })
const call = async (server: ReturnType<typeof createMcp>, name: string, args: object = {}) =>
  (await server.handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } })) as { result: { content: { type: string; text: string }[]; isError?: boolean } }
const text = (r: Awaited<ReturnType<typeof call>>) => r.result.content.map((c) => c.text).join('\n')

test('initialize: the protocol version the client asked for (when supported), the tools capability and instructions', async () => {
  const r = (await mcp().handle({ jsonrpc: '2.0', id: 0, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 't', version: '1' } } })) as { result: { protocolVersion: string; capabilities: object; serverInfo: { name: string }; instructions: string } }
  expect(r.result.protocolVersion).toBe('2025-03-26')
  expect(r.result.capabilities).toEqual({ tools: {} })
  expect(r.result.serverInfo.name).toBe('clarusjs')
  expect(r.result.instructions).toContain('check')
  const latest = (await mcp().handle({ jsonrpc: '2.0', id: 0, method: 'initialize', params: { protocolVersion: '1999-01-01' } })) as { result: { protocolVersion: string } }
  expect(latest.result.protocolVersion).toBe('2025-06-18')
})

test('tools/list: check, explain, compile and docs_search, each with an input schema', async () => {
  const r = (await mcp().handle({ jsonrpc: '2.0', id: 2, method: 'tools/list' })) as { result: { tools: { name: string; description: string; inputSchema: { type: string } }[] } }
  expect(r.result.tools.map((t) => t.name)).toEqual(['check', 'explain', 'compile', 'docs_search'])
  for (const t of r.result.tools) {
    expect(t.description.length).toBeGreaterThan(20)
    expect(t.inputSchema.type).toBe('object')
  }
})

test('compile: a component compiles, with its lint findings; a mistake is an error at file:line:col', async () => {
  const ok = await call(mcp(), 'compile', { source: '<script>\n  let n = state(0)\n</script>\n<button (click)="n++">{{ n }}</button>\n<img src="/a.png" />\n', file: 'src/components/c.tscl' })
  expect(ok.result.isError).toBeFalsy()
  expect(text(ok)).toContain('island: yes')
  expect(text(ok)).toContain('export function attach')
  expect(text(ok)).toContain('src/components/c.tscl:5:1 warning img-alt')
  const bad = await call(mcp(), 'compile', { source: '<p>\n  @if (x {\n' })
  expect(bad.result.isError).toBe(true)
  expect(text(bad)).toMatch(/^component\.tscl:2:\d+ /)
})

test("check: the project's type errors and lint findings, as clarusjs check reports them", async () => {
  const root = project({ 'src/pages/index.tscl': '@input n: number\n<p>{{ n.foo }}</p>\n<img src="/a.png" />\n' })
  const r = await call(mcp(root), 'check')
  expect(r.result.isError).toBe(true)
  expect(text(r)).toContain('src/pages/index.tscl:2:9 error TS2339')
  expect(text(r)).toContain('src/pages/index.tscl:3:1 warning img-alt')
  const clean = await call(mcp(project({ 'src/pages/index.tscl': '<h1>Hi</h1>\n' })), 'check')
  expect(clean.result.isError).toBeFalsy()
  expect(text(clean)).toContain('No errors')
}, 60_000)

test('explain: without a build, says to build first', async () => {
  const r = await call(mcp(project({ 'src/pages/index.tscl': '<h1>Hi</h1>\n' })), 'explain', { route: '/' })
  expect(r.result.isError).toBe(true)
  expect(text(r)).toMatch(/vite build/)
}, 30_000)

test('docs_search: the best sections of the docs, with their URLs, fetched once and cached', async () => {
  fetches = 0
  const server = mcp()
  const r = await call(server, 'docs_search', { query: 'island state reorder track' })
  expect(text(r)).toMatch(/^https:\/\/clarusjs\.com\/guide\/lists#keys\n/)
  expect(text(r)).toContain('https://clarusjs.com/guide/islands#editing-an-island')
  await call(server, 'docs_search', { query: 'island' })
  expect(fetches).toBe(1)
  expect(text(await call(server, 'docs_search', { query: 'zzzz' }))).toContain('No matches')
})

test('protocol: notifications get no answer, ping answers, unknown methods and tools are errors', async () => {
  const server = mcp()
  expect(await server.handle({ jsonrpc: '2.0', method: 'notifications/initialized' })).toBeUndefined()
  expect(await server.handle({ jsonrpc: '2.0', id: 3, method: 'ping' })).toEqual({ jsonrpc: '2.0', id: 3, result: {} })
  expect(await server.handle({ jsonrpc: '2.0', id: 4, method: 'nope' })).toMatchObject({ id: 4, error: { code: -32601 } })
  expect(await server.handle({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'nope' } })).toMatchObject({ id: 5, error: { code: -32602 } })
})

test('over stdio: newline-delimited JSON-RPC, as MCP clients start it (npx @clarusjs/ai mcp)', async () => {
  const child = spawn(process.execPath, ['--experimental-strip-types', '--no-warnings', resolve(import.meta.dirname, '../src/cli.ts'), 'mcp'], { cwd: workspace })
  const lines: object[] = []
  let buffer = ''
  child.stdout.on('data', (d: Buffer) => {
    buffer += d.toString()
    for (let i; (i = buffer.indexOf('\n')) >= 0; buffer = buffer.slice(i + 1)) lines.push(JSON.parse(buffer.slice(0, i)))
  })
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } }) + '\n')
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n')
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }) + '\n')
  for (let i = 0; i < 100 && lines.length < 2; i++) await new Promise((r) => setTimeout(r, 50))
  child.kill()
  expect(lines).toMatchObject([{ id: 1, result: { serverInfo: { name: 'clarusjs' } } }, { id: 2, result: { tools: expect.any(Array) } }])
}, 20_000)
