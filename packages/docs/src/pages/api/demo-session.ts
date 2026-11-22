// The Auth and cookies guide's demo session: GET who is signed in, POST { name } to sign in, DELETE to sign out.
// A demo: the "session" is the name itself in an HttpOnly cookie. A real app keeps a random session id there and the
// user in a database.
import type { RequestHandler } from 'clarusjs/server'

const headers = { 'cache-control': 'no-store' }

export const GET: RequestHandler = ({ locals }) => Response.json({ user: locals.user ?? null }, { headers })

export const POST: RequestHandler = async ({ request, cookies }) => {
  const { name } = (await request.json().catch(() => ({}))) as { name?: unknown }
  const clean = typeof name === 'string' ? name.trim().slice(0, 40) : ''
  if (!clean) return Response.json({ error: 'Type a name to sign in.' }, { status: 400, headers })
  cookies.set('demo-user', clean, { maxAge: 60 * 60 })
  return Response.json({ user: { name: clean } }, { headers })
}

export const DELETE: RequestHandler = ({ cookies }) => {
  cookies.delete('demo-user')
  return Response.json({ user: null }, { headers })
}
