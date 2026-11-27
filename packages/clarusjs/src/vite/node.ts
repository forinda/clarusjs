// Node http ⇄ fetch Request/Response, for the dev server, vite preview and clarusjs serve (bodies streamed both ways).
import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

export function toRequest(req: IncomingMessage): Request {
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach((v) => headers.append(key, v))
    else if (value !== undefined) headers.set(key, value)
  }
  const method = req.method ?? 'GET'
  // A body (POST, PUT, …) is streamed through; GET and HEAD have none.
  const body = method === 'GET' || method === 'HEAD' ? undefined : (Readable.toWeb(req) as ReadableStream)
  return new Request(`http://${req.headers.host ?? 'localhost'}${req.url ?? '/'}`, { method, headers, body, ...(body ? { duplex: 'half' } : {}) } as RequestInit)
}

/**
 * Streamed: a body is sent as it comes (an event stream, a long render), with backpressure. A client that goes away
 * cancels the body (pipeline destroys the source, which cancels the web stream).
 */
export async function sendResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status
  response.headers.forEach((value, key) => res.setHeader(key, value))
  if (!response.body) return void res.end()
  await pipeline(Readable.fromWeb(response.body as import('node:stream/web').ReadableStream), res).catch(() => {})
}

/** Whether an Accept-Encoding header allows `encoding`: named, or through `*`, and not with q=0. */
export function acceptsEncoding(header: string, encoding: string): boolean {
  let star = false
  for (const part of header.toLowerCase().split(',')) {
    const [name, ...params] = part.trim().split(';')
    const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='))
    const allowed = !q || Number(q.slice(2)) > 0
    if (name === encoding) return allowed
    if (name === '*') star = allowed
  }
  return star
}
