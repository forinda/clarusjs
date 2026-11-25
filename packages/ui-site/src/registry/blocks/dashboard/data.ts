// The dashboard block's data: the stat cards, the chart's 90 days and the table's rows, made up and the same on every
// build. Replace them with yours (load them in the page, or fetch them). The helpers filter, sort and page the rows.
import type { Series } from '~/components/ui/chart-geometry.ts'

export type Row = { id: string; header: string; type: string; status: 'Done' | 'In progress'; target: number; limit: number; reviewer: string }
export type SortKey = 'header' | 'type' | 'status' | 'target' | 'limit' | 'reviewer'

export const stats: { label: string; value: string; change: number; note: string }[] = [
  { label: 'Total revenue', value: '$1,250.00', change: 12.5, note: 'Trending up this month' },
  { label: 'New customers', value: '1,234', change: -20, note: 'Down 20% this period' },
  { label: 'Active accounts', value: '45,678', change: 12.5, note: 'Strong user retention' },
  { label: 'Growth rate', value: '4.5%', change: 4.5, note: 'Steady performance increase' },
]

const day = (i: number) => new Date(Date.UTC(2026, 7, 28 + i)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const wave = (i: number, base: number, swing: number) => Math.round(base + i * 1.5 + swing * Math.sin((i / 7) * Math.PI * 2) + ((i * 37) % 23))
const labels = Array.from({ length: 90 }, (_, i) => day(i))
export const visitors: { labels: string[]; series: Series[] } = {
  labels,
  series: [
    { name: 'Desktop', values: labels.map((_, i) => wave(i, 180, 40)) },
    { name: 'Mobile', values: labels.map((_, i) => wave(i, 90, 25)) },
  ],
}

const HEADERS = ['Cover page', 'Table of contents', 'Executive summary', 'Technical approach', 'Design', 'Capabilities', 'Integration with existing systems', 'Innovation and advantages', 'Overview of solutions', 'Advanced algorithms', 'Competitive landscape', 'Risk assessment', 'Budget', 'Timeline', 'Team', 'Training plan', 'Security', 'Data handling', 'Accessibility', 'Testing', 'Deployment', 'Support', 'Maintenance', 'Pricing', 'References', 'Appendix A', 'Appendix B', 'Glossary', 'Contact details', 'Terms']
const TYPES = ['Cover page', 'Table of contents', 'Narrative', 'Technical content', 'Plain language', 'Legal', 'Visual']
const REVIEWERS = ['Eddie Lake', 'Jamik Tashpulatov', 'Emily Whalen', 'Assign reviewer']
export const rows: Row[] = HEADERS.map((header, i) => ({
  id: String(i + 1),
  header,
  type: TYPES[i % TYPES.length]!,
  status: i % 3 === 0 ? 'In progress' : 'Done',
  target: 5 + ((i * 7) % 29),
  limit: 3 + ((i * 11) % 24),
  reviewer: REVIEWERS[i % REVIEWERS.length]!,
}))

/** The rows with that status ('all' for any) and every word of the query in their header, type or reviewer. */
export function filterRows(list: readonly Row[], status: string, query: string): Row[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return list.filter((r) => (status === 'all' || r.status === status) && words.every((w) => `${r.header} ${r.type} ${r.reviewer}`.toLowerCase().includes(w)))
}

/** A sorted copy: by that column, ascending or descending; rows that tie keep their order. */
export function sortRows(list: readonly Row[], key: string, dir: string): Row[] {
  const sign = dir === 'descending' ? -1 : 1
  const k = key as SortKey
  return [...list].sort((a, b) => {
    const x = a[k]
    const y = b[k]
    return sign * (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y)))
  })
}

/** Page `page` (from 0) of `size` rows, kept within the pages there are; one empty page for no rows. */
export function pageRows(list: readonly Row[], page: number, size: number): { page: number; pages: number; rows: Row[] } {
  const pages = Math.max(1, Math.ceil(list.length / size))
  const at = Math.min(Math.max(0, page), pages - 1)
  return { page: at, pages, rows: list.slice(at * size, at * size + size) }
}
