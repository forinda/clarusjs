// The dashboard block's sample data (data-table.test.ts covers the helpers that sort, filter and page it).
import { expect, test } from 'vitest'
import { rows, stats, visitors } from '../src/registry/blocks/dashboard/data.ts'

test('the sample: 4 stats, 90 days of two series, about 30 rows', () => {
  expect(stats).toHaveLength(4)
  expect(visitors.labels).toHaveLength(90)
  expect(visitors.series.map((s) => s.values.length)).toEqual([90, 90])
  expect(rows.length).toBeGreaterThanOrEqual(25)
  expect(new Set(rows.map((x) => x.id)).size).toBe(rows.length)
})
