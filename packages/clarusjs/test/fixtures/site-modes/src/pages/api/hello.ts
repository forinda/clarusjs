// An endpoint (#95): GET and POST, with the user handle() resolved.
import type { RequestHandler } from 'clarusjs/server'

export const GET: RequestHandler = ({ locals }) => Response.json({ hello: locals.user ?? 'nobody' })

export const POST: RequestHandler = async ({ request }) => Response.json({ echo: await request.json() }, { status: 201 })
