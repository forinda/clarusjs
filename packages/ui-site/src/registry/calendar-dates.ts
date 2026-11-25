// The calendar's dates: plain 'YYYY-MM-DD' strings, worked out in UTC so no time zone or daylight saving shifts a day.

export type Day = { iso: string; outside: boolean }

const pad = (n: number) => String(n).padStart(2, '0')

/** A Date (at UTC midnight) for 'YYYY-MM-DD', or null when it isn't a real day. */
export function parseIso(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return null
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return toIso(date) === iso ? date : null
}

/** 'YYYY-MM-DD' for a Date's UTC day. */
export function toIso(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

/** Today, in the visitor's own time zone. */
export function today(): string {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function addDays(iso: string, days: number): string {
  const d = parseIso(iso)!
  d.setUTCDate(d.getUTCDate() + days)
  return toIso(d)
}

/** Months later (or earlier); a day the target month doesn't have becomes its last (Jan 31 + 1 month = Feb 28). */
export function addMonths(iso: string, months: number): string {
  const d = parseIso(iso)!
  const day = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + months)
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, last))
  return toIso(d)
}

/** The first day of iso's week, weeks starting on firstDay (0 Sunday … 6 Saturday). */
export function weekStart(iso: string, firstDay: number): string {
  const back = (parseIso(iso)!.getUTCDay() - firstDay + 7) % 7
  return addDays(iso, -back)
}

/** The month of iso as six whole weeks (a steady height), each day marked outside when it's another month's. */
export function monthGrid(iso: string, firstDay: number): Day[][] {
  const month = iso.slice(0, 7)
  let day = weekStart(`${month}-01`, firstDay)
  const weeks: Day[][] = []
  for (let w = 0; w < 6; w++) {
    const week: Day[] = []
    for (let i = 0; i < 7; i++) {
      week.push({ iso: day, outside: day.slice(0, 7) !== month })
      day = addDays(day, 1)
    }
    weeks.push(week)
  }
  return weeks
}

/** iso kept within min and max ('' for no limit). ISO strings compare as dates. */
export function clamp(iso: string, min: string, max: string): string {
  if (min && iso < min) return min
  if (max && iso > max) return max
  return iso
}

/** Whether iso is between a and b, inclusive, in either order. */
export function inRange(iso: string, a: string, b: string): boolean {
  const [lo, hi] = a <= b ? [a, b] : [b, a]
  return iso >= lo && iso <= hi
}
