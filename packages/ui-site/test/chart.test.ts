// The chart: its geometry (pure) and what chart.tscl draws on the server.
import { expect, test } from 'vitest'
import { compile } from 'clarusjs/compiler'
import { render, source } from './render.ts'
import { areaPath, bars, chartLayout, linePath, scale, type Series } from '../src/registry/chart-geometry.ts'

const W = 600
const H = 240

test('scale: the top rounds up to a nice number, with ticks from 0', () => {
  const s = scale([{ name: 'a', values: [3, 7, 12] }], W, H)
  expect(s.max).toBe(15)
  expect(s.ticks).toEqual([0, 5, 10, 15])
  expect(scale([{ name: 'a', values: [180, 420] }], W, H).max).toBe(500)
  expect(scale([{ name: 'a', values: [0.4] }], W, H).max).toBe(0.4)
  const many = scale([{ name: 'a', values: [93] }, { name: 'b', values: [12] }], W, H)
  expect(many.max).toBeGreaterThanOrEqual(93)
  expect(many.ticks.length).toBeGreaterThanOrEqual(4)
  expect(many.ticks.length).toBeLessThanOrEqual(6)
})

test('scale: x spreads points across the width; y puts 0 at the bottom and max at the top', () => {
  const s = scale([{ name: 'a', values: [0, 5, 10] }], W, H)
  expect(s.x(0)).toBe(0)
  expect(s.x(2)).toBe(W)
  expect(s.y(0)).toBe(H)
  expect(s.y(s.max)).toBe(0)
})

test('a single point sits in the middle; all zeros give max 1 and no NaN', () => {
  const one = scale([{ name: 'a', values: [4] }], W, H)
  expect(one.x(0)).toBe(W / 2)
  const zeros = scale([{ name: 'a', values: [0, 0, 0] }], W, H)
  expect(zeros.max).toBe(1)
  for (const d of [linePath([0, 0, 0], zeros), areaPath([0, 0, 0], zeros), linePath([4], one)]) expect(d).not.toMatch(/NaN|Infinity/)
})

test('negative values and non-numbers are drawn at 0', () => {
  const s = scale([{ name: 'a', values: [-5, 10, Number.NaN] }], W, H)
  expect(s.max).toBe(10)
  expect(linePath([-5, 10, Number.NaN], s)).toBe(`M0,${H} L300,0 L600,${H}`)
})

test('linePath goes through each point; areaPath closes it down to the baseline', () => {
  const s = scale([{ name: 'a', values: [0, 10] }], W, H)
  expect(linePath([0, 10], s)).toBe(`M0,${H} L600,0`)
  expect(areaPath([0, 10], s)).toBe(`M0,${H} L600,0 L600,${H} L0,${H} Z`)
})

test('bars: one per value per series, side by side in each slot, heights to scale', () => {
  const series: Series[] = [{ name: 'a', values: [5, 10] }, { name: 'b', values: [10, 0] }]
  const s = scale(series, W, H)
  const r = bars(series, s, W)
  expect(r).toHaveLength(4)
  expect(r.filter((b) => b.series === 0)).toHaveLength(2)
  const [a0, b0] = [r.find((b) => b.series === 0 && b.index === 0)!, r.find((b) => b.series === 1 && b.index === 0)!]
  expect(b0.x).toBeGreaterThan(a0.x)
  expect(a0.h).toBeCloseTo(b0.h / 2)
  expect(a0.y + a0.h).toBe(H)
  for (const b of r) expect(b.x + b.w).toBeLessThanOrEqual(W)
})

test('chartLayout: ticks with their y, at most 8 x labels (first and last kept), a path per series or bars, all in one go', () => {
  const labels = Array.from({ length: 30 }, (_, i) => `D${i + 1}`)
  const series: Series[] = [{ name: 'Visitors', values: labels.map((_, i) => i * 3) }, { name: 'Sign-ups', values: labels.map(() => 5) }]
  const area = chartLayout(labels, series, 'area', 240)
  expect(area.width).toBe(600)
  expect(area.ticks[0]).toEqual({ value: 0, y: 240 })
  expect(area.labels.length).toBeLessThanOrEqual(8)
  expect(area.labels[0]!.text).toBe('D1')
  expect(area.labels.at(-1)!.text).toBe('D30')
  expect(area.paths).toHaveLength(2)
  expect(area.paths[0]!.area).toMatch(/Z$/)
  expect(area.bars).toEqual([])
  const line = chartLayout(labels, series, 'line', 240)
  expect(line.paths[0]!.area).toBe('')
  const bar = chartLayout(labels.slice(0, 3), series.map((s) => ({ ...s, values: s.values.slice(0, 3) })), 'bar', 240)
  expect(bar.paths).toEqual([])
  expect(bar.bars).toHaveLength(6)
})

const props = { label: 'Visitors over 3 days', labels: ['Mon', 'Tue', 'Wed'], series: [{ name: 'Desktop', values: [3, 7, 12] }, { name: 'Mobile', values: [1, 4, 2] }] }

test('chart.tscl: an image of the data, named, with a path per series (area), coloured by --ui-chart-N', async () => {
  const html = await render('chart.tscl', props)
  expect(html).toMatch(/<figure data-part="chart" data-type="area"/)
  expect(html).toMatch(/<svg role="img" aria-label="Visitors over 3 days"/)
  expect(html.match(/<path [^>]*data-part="chart-area"/g)).toHaveLength(2)
  expect(html.match(/<path [^>]*data-part="chart-line"/g)).toHaveLength(2)
  expect(html).toContain('--ui-chart-1')
  expect(html).toContain('--ui-chart-2')
  expect(html).toContain('>Wed</text>')
})

test('chart.tscl: bars as rects; line without the area', async () => {
  const bar = await render('chart.tscl', { ...props, type: 'bar' })
  expect(bar.match(/<rect [^>]*data-part="chart-bar"/g)).toHaveLength(6)
  expect(bar).not.toContain('chart-line')
  const line = await render('chart.tscl', { ...props, type: 'line' })
  expect(line).not.toContain('chart-area')
})

test('chart.tscl: the data as a visually hidden table, one row per label; a legend for several series', async () => {
  const html = await render('chart.tscl', props)
  expect(html).toMatch(/<table data-part="chart-table"><caption>Visitors over 3 days<\/caption>/)
  expect(html).toContain('<tr><th scope="row">Tue</th><td>7</td><td>4</td></tr>')
  expect(html).toMatch(/<ul data-part="chart-legend"[^>]*>.*Desktop.*Mobile.*<\/ul>/)
  expect(await render('chart.tscl', { ...props, series: props.series.slice(0, 1) })).not.toContain('chart-legend')
})

test('chart.tscl ships no JavaScript', () => {
  expect(compile(source('chart.tscl'), { file: 'chart.tscl', target: 'client' }).code.trim()).toBe('export {}')
})
