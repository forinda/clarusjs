// Node http ⇄ fetch Request/Response, for the dev server. POC: GET/HEAD only, no request body.
import type { IncomingMessage, ServerResponse } from 'node:http'

export function toRequest(req: IncomingMessage): Request {
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach((v) => headers.append(key, v))
    else if (value !== undefined) headers.set(key, value)
  }
  return new Request(`http://${req.headers.host ?? 'localhost'}${req.url ?? '/'}`, { method: req.method, headers })
}

export async function sendResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status
  response.headers.forEach((value, key) => res.setHeader(key, value))
  res.end(Buffer.from(await response.arrayBuffer()))
}
