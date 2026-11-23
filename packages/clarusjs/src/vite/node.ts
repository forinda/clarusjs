// Node http ⇄ fetch Request/Response, for the dev server and vite preview (request bodies streamed through).
import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'

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

export async function sendResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status
  response.headers.forEach((value, key) => res.setHeader(key, value))
  res.end(Buffer.from(await response.arrayBuffer()))
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
