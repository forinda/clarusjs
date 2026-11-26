// Fetching recipes (a feed, optimistic): posts and their likes, kept in this process's memory (a demo; the newest 20).
// GET answers { posts }. POST { text } publishes a post; POST { like: id, on } likes or unlikes one. Each answer comes
// after a moment; with ?fail=1 it fails (503) instead, so the page can show the rollback.
import type { RequestHandler } from 'clarusjs/server'

type Post = { id: number; text: string; likes: number; liked: boolean }
let next = 3
let posts: Post[] = [
  { id: 2, text: 'Islands attach only where there is something to do.', likes: 4, liked: false },
  { id: 1, text: 'Hello from the demo feed.', likes: 12, liked: false },
]
const headers = { 'cache-control': 'no-store' }
const fail = (message: string) => Response.json({ error: message }, { status: 503, headers })

export const GET: RequestHandler = async () => Response.json({ posts }, { headers })

export const POST: RequestHandler = async ({ request }) => {
  await new Promise((done) => setTimeout(done, 400))
  const failing = new URL(request.url).searchParams.get('fail')
  const body = (await request.json().catch(() => ({}))) as { text?: unknown; like?: unknown; on?: unknown }
  if (body.like !== undefined) {
    if (failing) return fail('The like wasn’t saved.')
    const post = posts.find((p) => p.id === Number(body.like))
    if (!post) return Response.json({ error: 'No such post.' }, { status: 404, headers })
    if (post.liked !== Boolean(body.on)) post.likes += body.on ? 1 : -1
    post.liked = Boolean(body.on)
    return Response.json(post, { headers })
  }
  if (failing) return fail('The post wasn’t published.')
  const text = String(body.text ?? '').trim().slice(0, 280)
  if (!text) return Response.json({ error: 'Write something first.' }, { status: 400, headers })
  const post = { id: next++, text, likes: 0, liked: false }
  posts = [post, ...posts].slice(0, 20)
  return Response.json(post, { headers })
}
