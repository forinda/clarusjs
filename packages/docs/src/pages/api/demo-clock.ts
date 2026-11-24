// Fetching recipes (polling): the server's time and how many times it was asked.
import type { RequestHandler } from 'clarusjs/server'

let asked = 0

export const GET: RequestHandler = async () =>
  Response.json({ now: new Date().toISOString(), asked: ++asked }, { headers: { 'cache-control': 'no-store' } })
