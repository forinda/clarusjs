// The Fetching guide's caching demo (a server route, see vite.config.ts): 20,000 records, a page at a time.
// ?page=&size=&q= answers { page, pages, total, rows }; ?rename=<id> marks that record renamed (a demo edit, kept in
// this process's memory).
const TOTAL = 20_000
const renamed = new Set<number>()
const headers = { 'cache-control': 'no-store' }
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const nameOf = (id: number) => (renamed.has(id) ? `Record ${id} (renamed)` : `Record ${id}`)

export async function load({ request }: { request: Request }) {
  const params = new URL(request.url).searchParams
  if (params.has('rename')) {
    const id = Number(params.get('rename'))
    if (Number.isInteger(id) && id >= 1 && id <= TOTAL) {
      if (renamed.size > 1000) renamed.clear() // a demo: keep the memory small
      renamed.add(id)
    }
    return Response.json({ ok: true }, { headers })
  }
  await new Promise((r) => setTimeout(r, 150)) // long enough to see the previous page stay while the next loads
  const size = clamp(Number(params.get('size')) || 10, 1, 50)
  const q = (params.get('q') ?? '').toLowerCase().slice(0, 40)
  // Without a filter the page is computed directly; with one, the matching ids are collected.
  const ids = q ? Array.from({ length: TOTAL }, (_, i) => i + 1).filter((id) => nameOf(id).toLowerCase().includes(q)) : undefined
  const total = ids ? ids.length : TOTAL
  const pages = Math.max(1, Math.ceil(total / size))
  const page = clamp(Number(params.get('page')) || 1, 1, pages)
  const from = (page - 1) * size
  const slice = ids ? ids.slice(from, from + size) : Array.from({ length: Math.min(size, TOTAL - from) }, (_, i) => from + i + 1)
  const rows = slice.map((id) => ({ id, name: nameOf(id) }))
  return Response.json({ page, pages, total, rows }, { headers })
}
