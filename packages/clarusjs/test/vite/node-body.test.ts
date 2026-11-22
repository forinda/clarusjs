// #95: a POST through dev or preview carries its body to the handler (Node request → fetch Request).
import { Readable } from 'node:stream'
import type { IncomingMessage } from 'node:http'
import { expect, test } from 'vitest'
import { toRequest } from '../../src/vite/node.ts'

const incoming = (method: string, body?: string) =>
  Object.assign(Readable.from(body === undefined ? [] : [Buffer.from(body)]), { method, url: '/api/x?a=1', headers: { host: 'localhost:5173', 'content-type': 'application/json' } }) as unknown as IncomingMessage

test('a POST body reaches the Request', async () => {
  const request = toRequest(incoming('POST', '{"rename":3}'))
  expect(request.method).toBe('POST')
  expect(request.url).toBe('http://localhost:5173/api/x?a=1')
  expect(await request.json()).toEqual({ rename: 3 })
})

test('GET and HEAD have no body', async () => {
  expect(toRequest(incoming('GET')).body).toBeNull()
  expect(toRequest(incoming('HEAD')).body).toBeNull()
})
