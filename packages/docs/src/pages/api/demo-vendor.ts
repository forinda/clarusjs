// Stands in for a third-party API that needs a secret key (the Fetching recipes' server proxy): it answers only with
// the key, and sends more than a page should show. The browser never calls it; /api/demo-weather does.
import type { RequestHandler } from 'clarusjs/server'

export const VENDOR_KEY = 'demo-secret-key' // a real key comes from the server's environment (process.env)
const WEATHER: Record<string, { temp: number; summary: string }> = {
  nairobi: { temp: 24, summary: 'Sunny spells' },
  oslo: { temp: 3, summary: 'Light snow' },
  lima: { temp: 19, summary: 'Overcast' },
}

export const GET: RequestHandler = async ({ request }) => {
  if (request.headers.get('authorization') !== 'Bearer ' + VENDOR_KEY) return Response.json({ error: 'A key is needed.' }, { status: 401 })
  const city = (new URL(request.url).searchParams.get('city') ?? '').toLowerCase()
  const now = WEATHER[city]
  if (!now) return Response.json({ error: 'Unknown city.' }, { status: 404 })
  return Response.json({ ...now, station: 'internal-7', account: 'acct_293' }, { headers: { 'cache-control': 'no-store' } })
}
