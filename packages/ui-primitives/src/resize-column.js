// resizeColumn: a table column's resize handle, dragged or moved with the keyboard (after TanStack Table's column
// resizing). It sets the column's width as it goes; onResize gets the width to keep (at the end of a drag).

/**
 * Make `handle` (inside a `<th>`) a vertical separator that resizes its column: drag it, or focus it and use the
 * arrow keys (by `step`), Home and End (to `min` and `max`). Right to left, the arrows and the drag follow the line.
 * @param {HTMLElement} handle
 * @param {{ min?: number, max?: number, step?: number, target?: HTMLElement, onResize?: (width: number) => void }} [options]
 *   `target`: the element to size (the handle's `<th>` unless you say).
 * @returns {() => void}
 * @example
 * <th>Name <span [use]="(el) => resizeColumn(el, { onResize: (w) => save('name', w) })" aria-label="Resize Name"></span></th>
 * @see https://clarusjs.com/guide/ui-primitives#resizecolumn
 */
export function resizeColumn(handle, { min = 48, max = 1e4, step = 16, target, onResize } = {}) {
  const col = /** @type {HTMLElement} */ (target ?? handle.closest('th'))
  const sign = () => (handle.closest('[dir]')?.getAttribute('dir') === 'rtl' ? -1 : 1)
  let width = Math.round(col.getBoundingClientRect().width)
  let from = 0
  let start = NaN
  const attrs = { role: 'separator', 'aria-orientation': 'vertical', tabindex: '0', 'aria-valuemin': min, 'aria-valuemax': max }
  for (const [k, v] of Object.entries(attrs)) if (!handle.hasAttribute(k)) handle.setAttribute(k, String(v))
  const set = (/** @type {number} */ w, /** @type {boolean} */ done) => {
    width = Math.round(Math.min(max, Math.max(min, w)))
    col.style.width = width + 'px'
    handle.setAttribute('aria-valuenow', String(width))
    if (done) onResize?.(width)
  }
  handle.setAttribute('aria-valuenow', String(width))
  /** @param {PointerEvent} e */
  const down = (e) => {
    if (e.button) return
    e.preventDefault()
    start = e.clientX
    from = width
    handle.setPointerCapture?.(e.pointerId)
  }
  /** @param {PointerEvent} e */
  const move = (e) => start === start && set(from + (e.clientX - start) * sign(), false)
  const up = () => {
    if (start !== start) return
    start = NaN
    set(width, true)
  }
  /** @param {KeyboardEvent} e */
  const key = (e) => {
    const by = { ArrowRight: width + step * sign(), ArrowLeft: width - step * sign(), Home: min, End: max }[e.key]
    if (by === undefined) return
    e.preventDefault()
    set(by, true)
  }
  /** @type {[string, (e: any) => void][]} */
  const on = [['pointerdown', down], ['pointermove', move], ['pointerup', up], ['pointercancel', up], ['keydown', key]]
  for (const [t, f] of on) handle.addEventListener(t, f)
  return () => { for (const [t, f] of on) handle.removeEventListener(t, f) }
}
