// #51: the MCP server's check tool on this site: what an agent working here runs after an edit.
import { resolve } from 'node:path'
import { createMcp } from '@clarusjs/ai'
import { expect, test } from 'vitest'

test("the site passes the MCP server's check", async () => {
  const server = createMcp({ cwd: resolve(import.meta.dirname, '..') })
  const r = (await server.handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'check', arguments: {} } })) as { result: { content: { text: string }[]; isError?: boolean } }
  expect(r.result.content[0]!.text).toBe('No errors.')
  expect(r.result.isError).toBeFalsy()
}, 120_000)
