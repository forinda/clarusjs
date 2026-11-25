// @vitest-environment happy-dom
// resizeColumn: a column's resize handle, by pointer or keyboard (after TanStack Table's column resizing).
import { afterEach, expect, test, vi } from 'vitest'
import { resizeColumn } from '../src/resize-column.js'

afterEach(() => { document.body.innerHTML = '' })
function table(dir = 'ltr') {
  document.body.innerHTML = `<table dir="${dir}"><thead><tr><th>Name <span class="h"></span></th></tr></thead></table>`
  const th = document.querySelector('th')!
  th.getBoundingClientRect = () => ({ width: 100 }) as DOMRect
  return { th, handle: document.querySelector('.h') as HTMLElement }
}
const pointer = (el: Element, type: string, clientX: number) => el.dispatchEvent(new MouseEvent(type, { clientX, bubbles: true, cancelable: true }))
const key = (el: Element, k: string) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }))

test('the handle becomes a focusable vertical separator with the width as its value', () => {
  const { handle } = table()
  resizeColumn(handle, { min: 60, max: 400 })
  expect(handle.getAttribute('role')).toBe('separator')
  expect(handle.getAttribute('aria-orientation')).toBe('vertical')
  expect(handle.tabIndex).toBe(0)
  expect([handle.getAttribute('aria-valuemin'), handle.getAttribute('aria-valuemax'), handle.getAttribute('aria-valuenow')]).toEqual(['60', '400', '100'])
})

test('dragging sets the column width as it goes (within min and max); onResize gets it when the drag ends', () => {
  const { th, handle } = table()
  const onResize = vi.fn()
  resizeColumn(handle, { min: 60, max: 400, onResize })
  pointer(handle, 'pointerdown', 0)
  pointer(handle, 'pointermove', 30)
  expect(th.style.width).toBe('130px')
  expect(handle.getAttribute('aria-valuenow')).toBe('130')
  expect(onResize).not.toHaveBeenCalled()
  pointer(handle, 'pointermove', -500)
  expect(th.style.width).toBe('60px')
  pointer(handle, 'pointerup', -500)
  expect(onResize).toHaveBeenCalledWith(60)
  pointer(handle, 'pointermove', 100) // not dragging any more
  expect(th.style.width).toBe('60px')
})

test('the keyboard: arrows by step, Home and End to the limits; each move is reported', () => {
  const { th, handle } = table()
  const onResize = vi.fn()
  resizeColumn(handle, { min: 60, max: 400, step: 10, onResize })
  key(handle, 'ArrowRight')
  expect(th.style.width).toBe('110px')
  expect(onResize).toHaveBeenLastCalledWith(110)
  key(handle, 'ArrowLeft')
  key(handle, 'ArrowLeft')
  expect(th.style.width).toBe('90px')
  key(handle, 'Home')
  expect(th.style.width).toBe('60px')
  key(handle, 'End')
  expect(onResize).toHaveBeenLastCalledWith(400)
})

test('right to left: dragging or pressing toward the end of the line widens it', () => {
  const { th, handle } = table('rtl')
  resizeColumn(handle)
  pointer(handle, 'pointerdown', 100)
  pointer(handle, 'pointermove', 70)
  expect(th.style.width).toBe('130px')
  pointer(handle, 'pointerup', 70)
  key(handle, 'ArrowLeft')
  expect(th.style.width).toBe('146px')
})

test('stopping it leaves the column alone', () => {
  const { th, handle } = table()
  resizeColumn(handle)()
  key(handle, 'ArrowRight')
  pointer(handle, 'pointerdown', 0)
  pointer(handle, 'pointermove', 50)
  expect(th.style.width).toBe('')
})
