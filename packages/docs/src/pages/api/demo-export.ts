// The Fetching guide's export demo (#431): a CSV (text/csv, so request() reads it as text), answered after `wait` ms
// (at most 5 s), so there is time to cancel it or let it time out.
import type { RequestHandler } from 'clarusjs/server'

export const GET: RequestHandler = async ({ request }) => {
  const url = new URL(request.url)
  const wait = Math.min(Number(url.searchParams.get('wait')) || 0, 5000)
  await new Promise((done) => setTimeout(done, wait))
  const rows = ['id,name,signups', '1,Ada,12', '2,Grace,9', '3,Alan,7']
  return new Response(rows.join('\n') + '\n', { headers: { 'content-type': 'text/csv; charset=utf-8', 'cache-control': 'no-store' } })
}
