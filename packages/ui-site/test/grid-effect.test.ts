// @vitest-environment happy-dom
// grid-effect.ts: the grid's reaction to a pointer over its section (spotlight, trail, lean). It listens on the
// section (the layer itself ignores the pointer), does nothing until the pointer enters, and nothing under reduced motion.
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { gridEffect } from '../src/registry/grid-effect.ts'

let frames: FrameRequestCallback[] = []
const flush = () => { const f = frames; frames = []; f.forEach((cb) => cb(0)) }
let reduce = false

beforeEach(() => {
  frames = []
  reduce = false
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb))
  vi.stubGlobal('cancelAnimationFrame', () => {})
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: reduce && q.includes('reduce') }))
})
afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = '' })

function setup(width = 480, height = 240) {
  document.body.innerHTML = '<section><div data-part="grid-effect"></div></section>'
  const host = document.querySelector('section')!
  const el = host.querySelector('div') as HTMLElement
  for (const [k, v] of [['clientWidth', width], ['clientHeight', height]] as const) Object.defineProperty(el, k, { value: v, configurable: true })
  return { host, el }
}
const fire = (host: Element, type: string, x = 0, y = 0, pointerType = 'mouse') =>
  host.dispatchEvent(Object.assign(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }), { pointerType }))

test('spotlight sets --ui-grid-x/y on the layer from the pointer position in the section', () => {
  const { host, el } = setup()
  gridEffect(el, { effect: 'spotlight' })
  fire(host, 'pointerenter', 30, 40)
  fire(host, 'pointermove', 30, 40)
  expect(el.style.getPropertyValue('--ui-grid-x')).toBe('30px')
  expect(el.style.getPropertyValue('--ui-grid-y')).toBe('40px')
  expect(el.hasAttribute('data-active')).toBe(true)
  fire(host, 'pointerleave')
  expect(el.hasAttribute('data-active')).toBe(false)
})

test('trail marks the cell under the pointer, by the current column count (after a resize too)', () => {
  const { host, el } = setup(480, 240) // 10 columns of 48
  gridEffect(el, { effect: 'trail' })
  fire(host, 'pointerenter', 100, 60)
  fire(host, 'pointermove', 100, 60) // row 1, column 2
  const on = () => [...el.querySelectorAll('[data-cell]')].findIndex((c) => c.hasAttribute('data-on'))
  expect(on()).toBe(1 * 10 + 2)
  flush(); flush()
  expect(on()).toBe(-1) // it fades: the mark goes after a frame
  Object.defineProperty(el, 'clientWidth', { value: 240, configurable: true }) // 5 columns
  fire(host, 'pointermove', 100, 60)
  expect(on()).toBe(1 * 5 + 2)
})

test('lean draws nothing until the pointer enters; redraws once per frame while inside; clears on leave', () => {
  const { host, el } = setup()
  gridEffect(el, { effect: 'lean' })
  expect(frames).toHaveLength(0)
  expect(el.querySelectorAll('path')).toHaveLength(0)
  fire(host, 'pointerenter', 100, 100)
  fire(host, 'pointermove', 100, 100)
  fire(host, 'pointermove', 104, 100)
  expect(frames).toHaveLength(1) // two moves, one frame
  flush()
  expect(el.querySelectorAll('path').length).toBeGreaterThan(0)
  expect(el.querySelectorAll('circle').length).toBeGreaterThan(0) // crossings near it swell into dots
  expect(host.hasAttribute('data-grid-lean')).toBe(true) // the static lines step aside while it draws
  fire(host, 'pointerleave')
  flush()
  expect(el.querySelectorAll('path')).toHaveLength(0)
  expect(host.hasAttribute('data-grid-lean')).toBe(false)
})

test('a touch pointer moves it the same way; the section gets touch-action: pan-y', () => {
  const { host, el } = setup()
  gridEffect(el, { effect: 'spotlight' })
  expect(host.style.touchAction).toBe('pan-y')
  fire(host, 'pointerenter', 10, 20, 'touch')
  fire(host, 'pointermove', 10, 20, 'touch')
  expect(el.style.getPropertyValue('--ui-grid-x')).toBe('10px')
})

test('dispose removes its listeners: moves after dispose change nothing', () => {
  const { host, el } = setup()
  const dispose = gridEffect(el, { effect: 'lean' })
  dispose()
  fire(host, 'pointerenter', 100, 100)
  fire(host, 'pointermove', 100, 100)
  expect(frames).toHaveLength(0)
})

test('reduced motion: no listeners, nothing drawn', () => {
  reduce = true
  const { host, el } = setup()
  gridEffect(el, { effect: 'spotlight' })
  fire(host, 'pointerenter', 30, 40)
  fire(host, 'pointermove', 30, 40)
  expect(el.style.getPropertyValue('--ui-grid-x')).toBe('')
  expect(el.hasAttribute('data-active')).toBe(false)
})

test('inside its <cl-island> wrapper (display: contents) it listens on the section around the wrapper', () => {
  document.body.innerHTML = '<section><cl-island><div data-part="grid-effect"></div></cl-island></section>'
  const host = document.querySelector('section')!
  const el = host.querySelector('div') as HTMLElement
  gridEffect(el, { effect: 'spotlight' })
  fire(host, 'pointermove', 12, 34)
  expect(el.style.getPropertyValue('--ui-grid-x')).toBe('12px')
  expect(host.style.touchAction).toBe('pan-y')
})
