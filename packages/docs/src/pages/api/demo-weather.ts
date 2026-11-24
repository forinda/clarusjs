// The Fetching recipes' server proxy: the island fetches this route; it calls the keyed API (/api/demo-vendor here)
// with the key, which never reaches the browser, and answers with only what the page shows.
import type { RequestHandler } from 'clarusjs/server'
import { VENDOR_KEY } from './demo-vendor.ts'

export const GET: RequestHandler = async ({ request }) => {
  const city = new URL(request.url).searchParams.get('city') ?? 'Nairobi'
  const res = await fetch(new URL('/api/demo-vendor?city=' + encodeURIComponent(city), request.url), {
    headers: { authorization: 'Bearer ' + VENDOR_KEY },
  })
  if (!res.ok) return Response.json({ error: res.status === 404 ? 'No weather for that city.' : 'The weather service is down.' }, { status: 502 })
  const { temp, summary } = await res.json()
  return Response.json({ temp, summary }, { headers: { 'cache-control': 'public, max-age=300' } })
}
