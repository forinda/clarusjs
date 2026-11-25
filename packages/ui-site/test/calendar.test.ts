// The calendar's dates: plain YYYY-MM-DD strings (no time zones), the month's grid, moving, limits, ranges.
import { expect, test } from 'vitest'
import {
  addDays,
  addMonths,
  clamp,
  inRange,
  monthGrid,
  parseIso,
  toIso,
  weekStart,
} from '../src/registry/calendar-dates.ts'

test('ISO dates in and out, with no time zone in the way', () => {
  expect(toIso(parseIso('2026-11-25')!)).toBe('2026-11-25')
  expect(parseIso('2026-02-30')).toBeNull()
  expect(parseIso('nope')).toBeNull()
  expect(parseIso('')).toBeNull()
})

test('adding days and months; a month too short keeps its last day', () => {
  expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
  expect(addMonths('2024-01-31', 1)).toBe('2024-02-29')
  expect(addMonths('2026-11-15', -12)).toBe('2025-11-15')
})

test('the month grid: whole weeks from the first day of the week; days outside the month are marked', () => {
  const grid = monthGrid('2026-11-25', 1) // weeks start on Monday
  expect(grid).toHaveLength(6)
  expect(grid.every((w) => w.length === 7)).toBe(true)
  expect(grid[0]![0]).toEqual({ iso: '2026-10-26', outside: true })
  expect(grid[0]![6]).toEqual({ iso: '2026-11-01', outside: false })
  expect(monthGrid('2026-11-25', 0)[0]![0]!.iso).toBe('2026-11-01') // Sunday start: Nov 1 2026 is a Sunday
})

test('week start, limits and ranges', () => {
  expect(weekStart('2026-11-25', 1)).toBe('2026-11-23')
  expect(weekStart('2026-11-25', 0)).toBe('2026-11-22')
  expect(clamp('2026-11-25', '2026-12-01', '')).toBe('2026-12-01')
  expect(clamp('2026-11-25', '', '2026-11-20')).toBe('2026-11-20')
  expect(clamp('2026-11-25', '', '')).toBe('2026-11-25')
  expect(inRange('2026-11-25', '2026-11-20', '2026-11-30')).toBe(true)
  expect(inRange('2026-11-25', '2026-11-30', '2026-11-20')).toBe(true) // either order
  expect(inRange('2026-12-01', '2026-11-20', '2026-11-30')).toBe(false)
})
