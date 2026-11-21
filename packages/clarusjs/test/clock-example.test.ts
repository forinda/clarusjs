// @vitest-environment happy-dom
// examples/counter's live clock: rendered on the server with the time it renders at, then ticking in the browser on
// each second, with one timer at a time, stopped when the island goes away.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, expect, test, vi } from 'vitest'
import { compile } from '../src/compiler/index.ts'
import { importCode } from './helpers.ts'

const file = resolve(import.meta.dirname, '../../../examples/counter/src/components/clock.tscl')
const source = readFileSync(file, 'utf8')
afterEach(() => { vi.useRealTimers(); document.body.innerHTML = '' })

test('the clock renders on the server, then ticks every second in the browser', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-21T10:00:00.250Z'))
  const server = await importCode(compile(source, { file: 'clock.tscl', target: 'server', clientUrl: '/clock.js' }).code, 'clock-s')
  const client = await importCode(compile(source, { file: 'clock.tscl', target: 'client' }).code, 'clock-c')
  document.body.innerHTML = server.render({})
  const time = () => document.querySelector('time')!
  expect(time().getAttribute('datetime')).toBe('2026-11-21T10:00:00.250Z')

  vi.setSystemTime(new Date('2026-11-21T10:00:05.250Z')) // the page is older than this moment (a built page)
  const before = vi.getTimerCount() // the test environment's own
  client.attach(document.querySelector('cl-island')!, {})
  expect(time().getAttribute('datetime')).toBe('2026-11-21T10:00:05.250Z') // caught up at once
  const shown = time().textContent

  vi.advanceTimersByTime(750) // to the next whole second
  expect(time().getAttribute('datetime')).toBe('2026-11-21T10:00:06.000Z')
  expect(time().textContent).not.toBe(shown)
  vi.advanceTimersByTime(1000)
  expect(time().getAttribute('datetime')).toBe('2026-11-21T10:00:07.000Z')
  expect(vi.getTimerCount()).toBe(before + 1) // one timer, not one per tick
})
