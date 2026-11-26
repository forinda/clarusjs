// Fetching recipes (editing a profile): one profile, kept in this process's memory (a demo). GET answers it; PUT
// { name, bio } saves it after a moment, or answers 400 with { errors } by field (a name over 40 characters), or with
// ?fail=1, 503: the page rolls back what it showed.
import type { RequestHandler } from 'clarusjs/server'

let profile = { name: 'Ada Lovelace', bio: 'Writes programs for engines that don’t exist yet.' }
const headers = { 'cache-control': 'no-store' }

export const GET: RequestHandler = async () => Response.json(profile, { headers })

export const PUT: RequestHandler = async ({ request }) => {
  await new Promise((done) => setTimeout(done, 400))
  if (new URL(request.url).searchParams.get('fail')) return Response.json({ error: 'The profile wasn’t saved.' }, { status: 503, headers })
  const body = (await request.json().catch(() => ({}))) as { name?: unknown; bio?: unknown }
  const name = String(body.name ?? '').trim()
  const bio = String(body.bio ?? '').trim().slice(0, 200)
  if (name.length > 40) return Response.json({ errors: { name: 'Use 40 characters or fewer.' } }, { status: 400, headers })
  profile = { name, bio }
  return Response.json(profile, { headers })
}
