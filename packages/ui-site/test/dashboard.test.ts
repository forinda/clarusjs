// The dashboard block's data helpers: filter, stable sort, pages.
import { expect, test } from 'vitest'
import { filterRows, pageRows, rows, sortRows, stats, visitors, type Row } from '../src/registry/blocks/dashboard/data.ts'

const r = (id: string, header: string, target: number, status: Row['status'] = 'Done'): Row => ({ id, header, type: 'Narrative', status, target, limit: 10, reviewer: 'Eddie Lake' })

test('the sample: 4 stats, 90 days of two series, about 30 rows', () => {
  expect(stats).toHaveLength(4)
  expect(visitors.labels).toHaveLength(90)
  expect(visitors.series.map((s) => s.values.length)).toEqual([90, 90])
  expect(rows.length).toBeGreaterThanOrEqual(25)
  expect(new Set(rows.map((x) => x.id)).size).toBe(rows.length)
})

test('sortRows: by a column, both ways; equal keys keep their order', () => {
  const list = [r('a', 'Beta', 2), r('b', 'Alpha', 1), r('c', 'Alpha', 3)]
  expect(sortRows(list, 'header', 'ascending').map((x) => x.id)).toEqual(['b', 'c', 'a'])
  expect(sortRows(list, 'header', 'descending').map((x) => x.id)).toEqual(['a', 'b', 'c'])
  expect(sortRows(list, 'target', 'descending').map((x) => x.id)).toEqual(['c', 'a', 'b'])
  expect(list.map((x) => x.id)).toEqual(['a', 'b', 'c']) // not changed in place
})

test('pageRows: a page of rows, past the last page the last one, none for no rows', () => {
  const list = Array.from({ length: 23 }, (_, i) => r(String(i), 'H', i))
  expect(pageRows(list, 1, 10).rows.map((x) => x.id)).toEqual(['10', '11', '12', '13', '14', '15', '16', '17', '18', '19'])
  expect(pageRows(list, 9, 10)).toEqual({ page: 2, pages: 3, rows: list.slice(20) })
  expect(pageRows([], 0, 10)).toEqual({ page: 0, pages: 1, rows: [] })
})

test('filterRows: by status and by words in the header, type or reviewer', () => {
  const list = [r('a', 'Cover page', 1, 'Done'), r('b', 'Table of contents', 2, 'In progress'), { ...r('c', 'Executive summary', 3, 'In progress'), reviewer: 'Jamik Tashpulatov' }]
  expect(filterRows(list, 'In progress', '').map((x) => x.id)).toEqual(['b', 'c'])
  expect(filterRows(list, 'all', 'jamik').map((x) => x.id)).toEqual(['c'])
  expect(filterRows(list, 'Done', 'contents')).toEqual([])
})
