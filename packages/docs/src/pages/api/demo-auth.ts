// Fetching recipes (token refresh): POST answers a new token, valid for 3 seconds; GET answers the secret for a valid
// `Authorization: Bearer <token>`, and 401 for an expired or missing one. Tokens live in this process's memory.
import type { RequestHandler } from 'clarusjs/server'

const issued = new Map<string, number>()
const LIFETIME = 3000
const headers = { 'cache-control': 'no-store' }

export const POST: RequestHandler = async () => {
  if (issued.size > 1000) issued.clear() // a demo: keep the memory small
  const token = crypto.randomUUID()
  issued.set(token, Date.now())
  return Response.json({ token, expiresIn: LIFETIME }, { headers })
}

export const GET: RequestHandler = async ({ request }) => {
  const token = /^Bearer (.+)$/.exec(request.headers.get('authorization') ?? '')?.[1]
  const at = token ? issued.get(token) : undefined
  if (at === undefined || Date.now() - at > LIFETIME) return Response.json({ error: 'expired' }, { status: 401, headers })
  return Response.json({ secret: 'The cake is in the fridge.', at: new Date().toISOString() }, { headers })
}
