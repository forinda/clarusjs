import { expect, test } from 'vitest'
import { derived, effect, state } from '../../src/runtime/signals.ts'

test('effect re-runs once per set', () => {
  const s = state(1)
  let runs = 0
  effect(() => { s.get(); runs++ })
  s.set(2)
  expect(runs).toBe(2)
})

test('setting an equal value notifies nobody', () => {
  const s = state(1)
  let runs = 0
  effect(() => { s.get(); runs++ })
  s.set(2)
  s.set(2)
  expect(runs).toBe(2)
})

test('derived follows its source', () => {
  const s = state(1)
  const d = derived(() => s.get() * 2)
  s.set(5)
  expect(d.get()).toBe(10)
})

test('effect reading a derived re-runs when the base changes', () => {
  const s = state(1)
  const d = derived(() => s.get() * 2)
  const seen: number[] = []
  effect(() => { seen.push(d.get()) })
  s.set(3)
  expect(seen).toEqual([2, 6])
})

test('disposed effect stops re-running', () => {
  const s = state(1)
  let runs = 0
  const stop = effect(() => { s.get(); runs++ })
  stop()
  s.set(9)
  expect(runs).toBe(1)
})

test('dependencies are dynamic', () => {
  const flag = state(true)
  const a = state(0)
  let runs = 0
  effect(() => { runs++; if (flag.get()) a.get() })
  flag.set(false)
  const before = runs
  a.set(1)
  expect(runs).toBe(before)
})
