// Fetching recipes (optimistic update): a like count. POST adds one, after a moment; with ?fail=1 it fails (503)
// instead, so the page can show the rollback.
import type { RequestHandler } from 'clarusjs/server'

let likes = 41
const headers = { 'cache-control': 'no-store' }

export const GET: RequestHandler = async () => Response.json({ likes }, { headers })

export const POST: RequestHandler = async ({ request }) => {
  await new Promise((done) => setTimeout(done, 400))
  if (new URL(request.url).searchParams.get('fail')) return Response.json({ error: 'The like wasn’t saved.' }, { status: 503, headers })
  likes++
  return Response.json({ likes }, { headers })
}
