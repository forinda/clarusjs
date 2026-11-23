// Fetching recipes (upload): a file sent as FormData, answered with its name, size and type. Nothing is stored.
// Slowed a little, so Cancel has time to work.
import type { RequestHandler } from 'clarusjs/server'

const MAX = 1024 * 1024

export const POST: RequestHandler = async ({ request }) => {
  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return Response.json({ error: 'Choose a file.' }, { status: 400 })
  if (file.size > MAX) return Response.json({ error: 'Files up to 1 MB.' }, { status: 413 })
  await new Promise((done) => setTimeout(done, 800))
  return Response.json({ name: file.name, size: file.size, type: file.type || 'unknown' })
}
