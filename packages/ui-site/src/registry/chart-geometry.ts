// The chart's geometry: pure functions from the data to SVG coordinates (no DOM). Values below 0, and anything that
// isn't a number, are drawn at 0.

export type Series = { name: string; values: readonly number[] }
export type Scale = { max: number; ticks: number[]; count: number; x(i: number): number; y(v: number): number }

const clean = (v: number) => (Number.isFinite(v) && v > 0 ? v : 0)
const round = (n: number) => Number(n.toFixed(10)) // 0.1 * 3 is 0.30000000000000004

/** A step of 1, 2 or 5 × a power of ten, near max / 5, so there are 4 to 6 ticks. */
function niceStep(max: number): number {
  const rough = max / 5
  const mag = 10 ** Math.floor(Math.log10(rough))
  return [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= rough)!
}

/** Where values go in a width × height box: the top is a nice number (1 for all zeros), the x of the i-th point. */
export function scale(series: readonly Series[], width: number, height: number): Scale {
  const top = Math.max(0, ...series.flatMap((s) => s.values.map(clean)))
  const step = top > 0 ? niceStep(top) : 0.2
  const max = top > 0 ? round(Math.ceil(round(top / step)) * step) : 1
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => round(i * step))
  const count = Math.max(1, ...series.map((s) => s.values.length))
  return {
    max,
    ticks,
    count,
    x: (i) => (count === 1 ? width / 2 : round((i / (count - 1)) * width)),
    y: (v) => round(height - (clean(v) / max) * height),
  }
}

/** A line through each value. */
export function linePath(values: readonly number[], s: Scale): string {
  return values.map((v, i) => `${i ? 'L' : 'M'}${s.x(i)},${s.y(v)}`).join(' ')
}

/** The line, closed down to the baseline (y of 0). */
export function areaPath(values: readonly number[], s: Scale): string {
  if (!values.length) return ''
  const base = s.y(0)
  return `${linePath(values, s)} L${s.x(values.length - 1)},${base} L${s.x(0)},${base} Z`
}

/** One bar per value per series: each label gets a slot of the width, its series' bars side by side in the middle 70%. */
export function bars(series: readonly Series[], s: Scale, width: number): { x: number; y: number; w: number; h: number; series: number; index: number }[] {
  const slot = width / s.count
  const w = round((slot * 0.7) / Math.max(1, series.length))
  return series.flatMap((one, n) =>
    one.values.map((v, i) => {
      const y = s.y(v)
      return { x: round(i * slot + slot * 0.15 + n * w), y, w, h: round(s.y(0) - y), series: n, index: i }
    }),
  )
}

/** Everything chart.tscl draws, in one go: gridlines, x labels (at most 8: every nth, the last always), and a path per
 *  series (area or line) or the bars. The plot is 600 wide; labels sit under it. */
export function chartLayout(labels: readonly string[], series: readonly Series[], type: 'area' | 'line' | 'bar', height: number) {
  const width = 600
  const s = scale(series, width, height)
  const bar = type === 'bar'
  const every = Math.ceil(labels.length / 8)
  const at = (i: number) => (bar ? round(((i + 0.5) * width) / s.count) : s.x(i))
  return {
    width,
    height,
    ticks: s.ticks.map((value) => ({ value, y: s.y(value) })),
    labels: labels
      .map((text, i) => ({ text, x: at(i), i }))
      .filter(({ i }) => i === labels.length - 1 || (i % every === 0 && labels.length - 1 - i >= every / 2)),
    paths: bar ? [] : series.map((one) => ({ line: linePath(one.values, s), area: type === 'area' ? areaPath(one.values, s) : '' })),
    bars: bar ? bars(series, s, width) : [],
  }
}
