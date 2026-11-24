// position: place a floating element (a popover, a menu, a tooltip) next to its anchor, inside the window. Sets Base
// UI's data-side and data-align and CSS variables for styling: --anchor-width, --anchor-height, --available-width,
// --available-height, --transform-origin.
// ponytail: JavaScript always; CSS anchor positioning (position-anchor, position-try) where supported would need none.
// Add it when a part can say all it needs in CSS.

/**
 * @typedef {object} PositionOptions
 * @property {'top' | 'bottom' | 'left' | 'right'} [side] Which side of the anchor. Default 'bottom'.
 * @property {'start' | 'center' | 'end'} [align] Along that side. Default 'center'.
 * @property {number} [offset] Gap from the anchor, in px. Default 4.
 * @property {boolean} [flip] The other side when there's no room on this one. Default true.
 */

/**
 * Position `floating` (fixed) by `anchor`, now and on scroll and resize.
 * @param {HTMLElement} floating
 * @param {Element} anchor
 * @param {PositionOptions} [options]
 * @returns {() => void} Stops following.
 * @example
 * @if (open) { <div [use]="(el) => position(el, trigger)">…</div> }
 * @see https://clarusjs.com/guide/ui-primitives#position
 */
export function position(floating, anchor, options = {}) {
  const { align = 'center', offset = 4, flip = true } = options
  const opposite = /** @type {const} */ ({ top: 'bottom', bottom: 'top', left: 'right', right: 'left' })
  const place = () => {
    const a = anchor.getBoundingClientRect()
    const f = floating.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const room = { top: a.top - offset, bottom: vh - a.bottom - offset, left: a.left - offset, right: vw - a.right - offset }
    let side = options.side ?? 'bottom'
    const size = side === 'top' || side === 'bottom' ? f.height : f.width
    if (flip && room[side] < size && room[opposite[side]] > room[side]) side = opposite[side]
    const vertical = side === 'top' || side === 'bottom'
    const along = (start = 0, length = 0, own = 0) => (align === 'start' ? start : align === 'end' ? start + length - own : start + (length - own) / 2)
    const top = side === 'bottom' ? a.bottom + offset : side === 'top' ? a.top - offset - f.height : along(a.top, a.height, f.height)
    const left = side === 'right' ? a.right + offset : side === 'left' ? a.left - offset - f.width : along(a.left, a.width, f.width)
    const s = floating.style
    s.position = 'fixed'
    s.top = `${Math.round(top)}px`
    s.left = `${Math.round(Math.min(Math.max(left, 0), Math.max(vw - f.width, 0)))}px`
    floating.dataset.side = side
    floating.dataset.align = align
    s.setProperty('--anchor-width', `${a.width}px`)
    s.setProperty('--anchor-height', `${a.height}px`)
    s.setProperty('--available-height', `${Math.max(vertical ? room[side] : vh, 0)}px`)
    s.setProperty('--available-width', `${Math.max(vertical ? vw : room[side], 0)}px`)
    s.setProperty('--transform-origin', vertical ? `${align === 'start' ? 'left' : align === 'end' ? 'right' : 'center'} ${opposite[side]}` : `${opposite[side]} center`)
  }
  place()
  const options_ = { passive: true, capture: true }
  window.addEventListener('scroll', place, options_)
  window.addEventListener('resize', place, options_)
  return () => {
    window.removeEventListener('scroll', place, options_)
    window.removeEventListener('resize', place, options_)
  }
}
