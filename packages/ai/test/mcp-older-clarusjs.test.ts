// With a clarusjs older than built-in icons (no clarusjs/icons export), the MCP server still starts and compiles:
// <icon> is then a compile error, as in the playground.
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { expect, test, vi } from 'vitest'

vi.mock('clarusjs/icons', () => {
  throw Object.assign(new Error("Package subpath './icons' is not defined by \"exports\""), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' })
})

test('the MCP server starts and compiles without clarusjs/icons', async () => {
  const { createMcp } = await import('../src/mcp.ts')
  const server = createMcp({ cwd: process.cwd(), fetch: (async () => new Response('')) as typeof fetch, cacheDir: mkdtempSync(resolve(tmpdir(), 'clarus-mcp-old-')) })
  const r = (await server.handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'compile', arguments: { source: '<p>hi</p>\n' } } })) as { result: { isError?: boolean; content: { text: string }[] } }
  expect(r.result.isError).toBeFalsy()
  expect(r.result.content[0]!.text).toContain('island: no')
})
