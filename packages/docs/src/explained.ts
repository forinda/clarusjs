// "This site, explained" (/guide/explained): the route manifest as a few numbers and one row per route, for the
// table island (filter, sort, sample size, columns). Build time only.

type Island = { component: string; count: number; attach: string }
type Manifest = { routes: Record<string, { islands: Island[]; js: { initialGzip: number; gzip: number } }> } | null

/** One route: its section, its islands (as text, and how many), and its JavaScript (gzip bytes) on load and in all. */
export type Row = { route: string; section: string; islands: string; islandCount: number; load: number; all: number }

/** Sections by their first path segment, in the sidebar's order; anything else is Other. */
export const SECTIONS = ['Guide', 'Learn', 'Reference', 'Other'] as const
const sectionOf = (route: string) => SECTIONS.find((s) => s !== 'Other' && (route === `/${s.toLowerCase()}` || route.startsWith(`/${s.toLowerCase()}/`))) ?? 'Other'

export const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`

export function explain(manifest: Manifest) {
  const rows: Row[] = Object.entries(manifest?.routes ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([route, r]) => ({
      route,
      section: sectionOf(route),
      islands: r.islands.map((i) => i.component + (i.count > 1 ? ' ×' + i.count : '') + (i.attach === 'load' ? '' : ' (' + i.attach + ')')).join(', ') || 'none',
      islandCount: r.islands.reduce((n, i) => n + i.count, 0),
      load: r.js.initialGzip,
      all: r.js.gzip,
    }))
  return {
    stats: {
      pages: rows.length,
      noJs: rows.filter((r) => r.load === 0).length,
      withIslands: rows.filter((r) => r.islandCount).length,
      heaviest: kb(Math.max(0, ...rows.map((r) => r.load))),
    },
    rows,
  }
}
