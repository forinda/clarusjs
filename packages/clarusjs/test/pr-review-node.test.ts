// Regression tests for the CodeRabbit review on PR #1 (server side).
import { expect, test } from 'vitest'
import { island } from '../src/runtime/server.ts'
import { createHandler } from '../src/server/handler.ts'
import { clientUrlFor } from '../src/vite/plugin.ts'

test('non-finite numbers in island props round-trip (#14), instead of silently becoming null', async () => {
  const { parse } = await import('../src/runtime/serialize.ts')
  const p = island('c', '/c', { n: Infinity, a: [1, NaN] }, '').match(/ p="([^"]*)"/)![1]!.replace(/&quot;/g, '"')
  const back = parse(p) as { n: number; a: number[] }
  expect(back.n).toBe(Infinity)
  expect(back.a[1]).toBeNaN()
})

const handler = createHandler({
  '/src/pages/index.clarus': async () => ({ render: () => '<p>text</p><!-- <cl-island c="x"> -->' }),
  '/src/pages/app.clarus': async () => ({ render: () => '<cl-island c="c" src="/c" p="{}"></cl-island>' }),
})

test('an island inside an HTML comment does not add the loader', async () => {
  const html = await (await handler.fetch(new Request('http://x/'))).text()
  expect(html).not.toContain('<script')
})

test('HEAD responses have no body', async () => {
  const ok = await handler.fetch(new Request('http://x/app', { method: 'HEAD' }))
  expect(ok.status).toBe(200)
  expect(ok.body).toBeNull()
  const missing = await handler.fetch(new Request('http://x/missing', { method: 'HEAD' }))
  expect(missing.status).toBe(404)
  expect(missing.body).toBeNull()
})

test('island URLs for files outside the Vite root use /@fs/', () => {
  expect(clientUrlFor('/app', '/app/src/components/c.clarus')).toBe('/src/components/c.clarus?import')
  expect(clientUrlFor('/app', '/libs/ui/c.clarus')).toBe('/@fs/libs/ui/c.clarus?import')
})
