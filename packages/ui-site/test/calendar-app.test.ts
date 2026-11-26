// The calendar block's helpers: events per day, the week, overlapping events side by side, the form's rules.
import { expect, test } from 'vitest'
import {
  CATEGORIES,
  eventsOn,
  layoutDay,
  rangeTitle,
  sampleEvents,
  toMinutes,
  validateEvent,
  weekDays,
  type CalEvent,
} from '../src/registry/blocks/calendar-app/data.ts'

const ev = (id: string, date: string, start = '', end = '', category: CalEvent['category'] = 'work'): CalEvent => ({
  id,
  title: id,
  date,
  start,
  end,
  category,
})

test('eventsOn: that day only, all-day first, then by start time', () => {
  const list = [
    ev('b', '2026-11-26', '13:00', '14:00'),
    ev('x', '2026-11-27', '09:00', '10:00'),
    ev('a', '2026-11-26'),
    ev('c', '2026-11-26', '09:30', '10:00'),
  ]
  expect(eventsOn(list, '2026-11-26').map((e) => e.id)).toEqual(['a', 'c', 'b'])
})

test("weekDays: seven days from the week's first day", () => {
  expect(weekDays('2026-11-26', 1)).toEqual([
    '2026-11-23',
    '2026-11-24',
    '2026-11-25',
    '2026-11-26',
    '2026-11-27',
    '2026-11-28',
    '2026-11-29',
  ])
  expect(weekDays('2026-11-26', 0)[0]).toBe('2026-11-22')
})

test('layoutDay: timed events placed by minutes; overlapping ones share the width in lanes', () => {
  const placed = layoutDay([
    ev('a', 'd', '09:00', '10:30'),
    ev('b', 'd', '10:00', '11:00'),
    ev('c', 'd', '11:00', '12:00'),
    ev('all', 'd'),
  ])
  const by = Object.fromEntries(placed.map((p) => [p.event.id, p]))
  expect(Object.keys(by).sort()).toEqual(['a', 'b', 'c']) // all-day events aren't on the time grid
  expect([by.a!.top, by.a!.height]).toEqual([540, 90])
  expect([by.a!.lane, by.a!.lanes, by.b!.lane, by.b!.lanes]).toEqual([0, 2, 1, 2])
  expect([by.c!.lane, by.c!.lanes]).toEqual([0, 1]) // starts as b ends: no overlap
  expect(toMinutes('13:45')).toBe(825)
})

// Intl puts thin spaces around a range's dash.
const plain = (s: string) => s.replace(/\s/g, ' ')

test('rangeTitle: the month, the week (across months too) or the day', () => {
  expect(rangeTitle('month', '2026-11-26', 0)).toBe('November 2026')
  expect(plain(rangeTitle('week', '2026-11-26', 1))).toBe('Nov 23 – 29, 2026')
  expect(plain(rangeTitle('week', '2026-12-01', 1))).toBe('Nov 30 – Dec 6, 2026')
  expect(rangeTitle('day', '2026-11-26', 0)).toBe('Thursday, November 26, 2026')
})

test('validateEvent: a title and a date; times both or neither, the end after the start; a known category', () => {
  const good = { title: 'Standup', date: '2026-11-26', allDay: false, start: '09:00', end: '09:15', category: 'work' }
  expect(validateEvent(good)).toEqual({})
  expect(validateEvent({ ...good, title: '  ' }).title).toBe('Give it a title.')
  expect(validateEvent({ ...good, date: '' }).date).toBe('Pick a date.')
  expect(validateEvent({ ...good, end: '08:00' }).end).toBe('End after it starts.')
  expect(validateEvent({ ...good, start: '' }).start).toBe('Pick a start time, or make it all day.')
  expect(validateEvent({ ...good, allDay: true, start: '', end: '' })).toEqual({})
  expect(validateEvent({ ...good, category: 'nope' }).category).toBe('Pick a category.')
})

test('sampleEvents: about a dozen around the given day, each in a known category, ids unique', () => {
  const list = sampleEvents('2026-11-26')
  expect(list.length).toBeGreaterThanOrEqual(10)
  expect(new Set(list.map((e) => e.id)).size).toBe(list.length)
  expect(list.every((e) => CATEGORIES.some((c) => c.id === e.category))).toBe(true)
  expect(list.some((e) => e.date === '2026-11-26')).toBe(true)
  expect(list.filter((e) => e.date === '2026-11-26').length).toBeGreaterThanOrEqual(4) // enough for "+N more"
})
