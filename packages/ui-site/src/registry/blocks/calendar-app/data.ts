// The calendar block's data and rules: its events (made up, around today: replace them with yours), the categories
// that colour them, and the pure helpers the board uses to lay out a month, a week or a day. Dates are
// 'YYYY-MM-DD' and times 'HH:MM', so no time zone shifts an event.
import { addDays, parseIso, weekStart } from '~/components/ui/calendar-dates.ts'

export type Category = 'work' | 'personal' | 'focus' | 'travel'
/** An event: all day when it has no start (and no end). */
export type CalEvent = { id: string; title: string; date: string; start: string; end: string; category: Category }
export type View = 'month' | 'week' | 'day'
/** The event form's fields, as the form sends them. */
export type EventForm = { title: string; date: string; allDay: boolean; start: string; end: string; category: string }

/** The categories, each with its colour (a chart token) and label. */
export const CATEGORIES: { id: Category; label: string; color: string }[] = [
  { id: 'work', label: 'Work', color: 'var(--ui-chart-1)' },
  { id: 'personal', label: 'Personal', color: 'var(--ui-chart-2)' },
  { id: 'focus', label: 'Focus', color: 'var(--ui-chart-3)' },
  { id: 'travel', label: 'Travel', color: 'var(--ui-chart-4)' },
]

export const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))

/** That day's events: all-day first, then by start time. */
export function eventsOn(events: readonly CalEvent[], iso: string): CalEvent[] {
  return events
    .filter((e) => e.date === iso)
    .sort((a, b) => (a.start ? toMinutes(a.start) : -1) - (b.start ? toMinutes(b.start) : -1))
}

/** The seven days of iso's week, from firstDay (0 Sunday … 6 Saturday). */
export function weekDays(iso: string, firstDay: number): string[] {
  const first = weekStart(iso, firstDay)
  return Array.from({ length: 7 }, (_, i) => addDays(first, i))
}

export type Placed = { event: CalEvent; top: number; height: number; lane: number; lanes: number }

/**
 * A day's timed events on a time grid: top and height in minutes, and events that overlap side by side (lane of
 * lanes, across each group that overlaps). All-day events aren't placed.
 */
export function layoutDay(events: readonly CalEvent[]): Placed[] {
  const timed = events.filter((e) => e.start).sort((a, b) => toMinutes(a.start) - toMinutes(b.start))
  const placed: Placed[] = []
  let group: Placed[] = []
  let groupEnd = -1
  const close = () => {
    const lanes = Math.max(1, ...group.map((p) => p.lane + 1))
    for (const p of group) p.lanes = lanes
    group = []
  }
  for (const event of timed) {
    const top = toMinutes(event.start)
    const bottom = Math.max(top + 15, event.end ? toMinutes(event.end) : top + 60)
    if (top >= groupEnd) close()
    // The first lane whose last event has ended.
    let lane = 0
    while (group.some((p) => p.lane === lane && p.top + p.height > top)) lane++
    const p = { event, top, height: bottom - top, lane, lanes: 1 }
    group.push(p)
    placed.push(p)
    groupEnd = Math.max(groupEnd, bottom)
  }
  close()
  return placed
}

const format = (iso: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...options }).format(parseIso(iso) ?? undefined)

/** The header's title for a view around iso: "November 2026", "Nov 23 – 29, 2026" or "Thursday, November 26, 2026". */
export function rangeTitle(view: View, iso: string, firstDay: number): string {
  if (view === 'month') return format(iso, { month: 'long', year: 'numeric' })
  if (view === 'day') return format(iso, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const days = weekDays(iso, firstDay)
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).formatRange(parseIso(days[0]!)!, parseIso(days[6]!)!)
}

/** What's wrong with an event form, by field ({} when nothing). */
export function validateEvent(form: EventForm): Partial<Record<keyof EventForm, string>> {
  const errors: Partial<Record<keyof EventForm, string>> = {}
  if (!form.title.trim()) errors.title = 'Give it a title.'
  if (!parseIso(form.date)) errors.date = 'Pick a date.'
  if (!form.allDay) {
    if (!form.start) errors.start = 'Pick a start time, or make it all day.'
    else if (!form.end) errors.end = 'Pick an end time.'
    else if (toMinutes(form.end) <= toMinutes(form.start)) errors.end = 'End after it starts.'
  }
  if (!CATEGORIES.some((c) => c.id === form.category)) errors.category = 'Pick a category.'
  return errors
}

/** About a dozen made-up events around today: replace them with yours (load them in the page, or fetch them). */
export function sampleEvents(today: string): CalEvent[] {
  const on = (days: number) => addDays(today, days)
  const list: Omit<CalEvent, 'id'>[] = [
    { title: 'Standup', date: on(0), start: '09:00', end: '09:15', category: 'work' },
    { title: 'Design review', date: on(0), start: '10:00', end: '11:30', category: 'work' },
    { title: 'Write the spec', date: on(0), start: '10:30', end: '12:00', category: 'focus' },
    { title: 'Lunch with Sam', date: on(0), start: '12:30', end: '13:30', category: 'personal' },
    { title: 'Ship the release', date: on(0), start: '', end: '', category: 'work' },
    { title: 'Gym', date: on(1), start: '07:00', end: '08:00', category: 'personal' },
    { title: 'Planning', date: on(1), start: '14:00', end: '15:00', category: 'work' },
    { title: 'Flight to Nairobi', date: on(2), start: '06:40', end: '09:10', category: 'travel' },
    { title: 'Deep work', date: on(-1), start: '13:00', end: '16:00', category: 'focus' },
    { title: 'Dentist', date: on(-2), start: '16:00', end: '16:45', category: 'personal' },
    { title: 'Team offsite', date: on(5), start: '', end: '', category: 'work' },
    { title: 'Book club', date: on(8), start: '19:00', end: '20:30', category: 'personal' },
    { title: 'Quarterly review', date: on(-6), start: '11:00', end: '12:00', category: 'work' },
  ]
  return list.map((e, i) => ({ id: 'e' + (i + 1), ...e }))
}
