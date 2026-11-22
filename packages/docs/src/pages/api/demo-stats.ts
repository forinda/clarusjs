// The Fetching guide's demo API (an endpoint: a .ts file under src/pages exporting GET): ?keys=a,b answers { a: …, b: … }. A request
// with &fail=<id> fails once per id (503), so the activity feed's retry shows.
const DATA: Record<string, unknown> = {
  visits: 12400,
  signups: 318,
  revenue: 9200,
  user: { id: 7, name: 'Ada', role: 'Admin' },
}
const ACTIVITY = ['Opened the dashboard', 'Invited a teammate', 'Exported a report']
const failed = new Set<string>()

import type { RequestHandler } from 'clarusjs/server'

export const GET: RequestHandler = async ({ request }) => {
  const url = new URL(request.url)
  const fail = url.searchParams.get('fail')
  if (fail && !failed.has(fail)) {
    if (failed.size > 1000) failed.clear() // a demo: keep the memory small
    failed.add(fail)
    return new Response('Try again', { status: 503, headers: { 'cache-control': 'no-store' } })
  }
  await new Promise((r) => setTimeout(r, 250)) // long enough to see the loading states
  const keys = (url.searchParams.get('keys') ?? '').split(',').filter(Boolean).slice(0, 20)
  const answers = Object.fromEntries(keys.flatMap((k) => (k in DATA ? [[k, DATA[k]]] : k.startsWith('activity:') ? [[k, ACTIVITY]] : [])))
  return Response.json(answers, { headers: { 'cache-control': 'no-store' } })
}
