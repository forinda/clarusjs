// Data table helpers: sort, filter, page and count rows, and keep a table's state in the URL. Pure functions over
// plain rows, so they run the same on the server (for a page that works without JavaScript) and in an island.
// After TanStack Table's sorting, filtering, pagination and faceting, without its table object.

export type Sort = { id: string; desc: boolean }[]
export type TableState = { sort: Sort; query: string; filters: Record<string, string[]>; page: number }
export type Page<T> = {
  page: number
  pages: number
  rows: T[]
  from: number
  to: number
  total: number
  canPrev: boolean
  canNext: boolean
}
/** How to read a column's value from a row: by default, the row's property of that name. */
export type Get<T> = (row: T, id: string) => unknown

const prop = <T>(row: T, id: string) => (row as Record<string, unknown>)[id]
// Natural order: 'item 2' before 'item 10', and case only breaks ties.
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
const missing = (v: unknown) => v === undefined || v === null || v === ''

function compare(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return collator.compare(String(a), String(b))
}

/** A sorted copy, by each column in turn. Rows that tie keep their order; missing values go last either way. */
export function sortRows<T>(rows: readonly T[], sort: Sort, get: Get<T> = prop): T[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((x, y) => {
      for (const { id, desc } of sort) {
        const a = get(x.row, id)
        const b = get(y.row, id)
        if (missing(a) || missing(b)) {
          if (missing(a) !== missing(b)) return missing(a) ? 1 : -1
          continue
        }
        const order = compare(a, b)
        if (order) return desc ? -order : order
      }
      return x.index - y.index
    })
    .map((x) => x.row)
}

/**
 * The sort after a click on column id: ascending, then descending, then off (descFirst starts descending). Without
 * multi it sorts by that column alone; with it (Shift-click, say) the column is added to, or stepped within, the rest.
 */
export function nextSort(sort: Sort, id: string, { multi = false, descFirst = false } = {}): Sort {
  const now = sort.find((s) => s.id === id)
  const rest = multi ? sort.filter((s) => s.id !== id) : []
  if (!now) return [...rest, { id, desc: descFirst }]
  if (now.desc === descFirst)
    return multi ? sort.map((s) => (s.id === id ? { id, desc: !descFirst } : s)) : [{ id, desc: !descFirst }]
  return rest
}

/**
 * The rows with every word of query (any case) in one of columns (every property, if none are given), and, for
 * each filter, a value that is one of its values. A filter with no values is ignored.
 */
export function filterRows<T>(
  rows: readonly T[],
  { query = '', columns = [] as string[], filters = {} as Record<string, readonly string[]> } = {},
  get: Get<T> = prop,
): T[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const active = Object.entries(filters).filter(([, values]) => values.length)
  return rows.filter((row) => {
    if (!active.every(([id, values]) => values.includes(String(get(row, id))))) return false
    if (!words.length) return true
    const ids = columns.length ? columns : Object.keys(row as object)
    const text = ids
      .map((id) => String(get(row, id) ?? ''))
      .join(' ')
      .toLowerCase()
    return words.every((w) => text.includes(w))
  })
}

/** Page `page` (from 0) of `size` rows, kept within the pages there are (one empty page for no rows). */
export function paginate<T>(rows: readonly T[], page: number, size: number): Page<T> {
  const pages = Math.max(1, Math.ceil(rows.length / size))
  const at = Math.min(Math.max(0, Math.floor(page) || 0), pages - 1)
  const slice = rows.slice(at * size, at * size + size)
  const from = slice.length ? at * size + 1 : 0
  return {
    page: at,
    pages,
    rows: slice,
    from,
    to: from ? from + slice.length - 1 : 0,
    total: rows.length,
    canPrev: at > 0,
    canNext: at < pages - 1,
  }
}

/** How many rows have each value of column id, in first-seen order: for filter buttons ("Done (20)"). */
export function facets<T>(rows: readonly T[], id: string, get: Get<T> = prop): Map<string, number> {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const value = String(get(row, id))
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return counts
}

/**
 * A table's state from the URL: ?sort=size.desc,name&q=…&status=Done&page=3 (pages count from 1 in the URL, from 0
 * here). filterIds names the parameters that are filters; anything unreadable falls back to the default.
 */
export function parseTable(params: URLSearchParams, filterIds: readonly string[]): TableState {
  const sort = (params.get('sort') ?? '')
    .split(',')
    .filter(Boolean)
    .map((s) => {
      const dot = s.lastIndexOf('.')
      return dot < 0 ? { id: s, desc: false } : { id: s.slice(0, dot), desc: s.slice(dot + 1) === 'desc' }
    })
  const page = Number.parseInt(params.get('page') ?? '', 10)
  return {
    sort,
    query: params.get('q') ?? '',
    filters: Object.fromEntries(filterIds.map((id) => [id, params.getAll(id)])),
    page: page > 0 ? page - 1 : 0,
  }
}

/** The URL query for a table's state (without '?'), leaving out what's at its default: '' for a fresh table. */
export function serializeTable(state: TableState): string {
  const params = new URLSearchParams()
  if (state.sort.length) params.set('sort', state.sort.map((s) => (s.desc ? `${s.id}.desc` : s.id)).join(','))
  if (state.query) params.set('q', state.query)
  for (const [id, values] of Object.entries(state.filters)) for (const v of values) params.append(id, v)
  if (state.page > 0) params.set('page', String(state.page + 1))
  return params.toString().replaceAll('%2C', ',') // commas are fine in a query, and easier to read
}
