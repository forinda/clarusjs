// rovingFocus: one Tab stop for a group (a toolbar, tabs, a menu, a listbox), arrow keys between its items.
// Ported from Radix's RovingFocusGroup and Base UI's composite: getFocusIntent's key map, RTL, disabled items skipped.

/** Items that can't take focus: disabled, or aria-disabled. */
export const disabled = (/** @type {Element} */ el) => el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true'

/**
 * @typedef {object} RovingFocusOptions
 * @property {string} [items] Which descendants are the items (a selector). Default: tabs, menu items, options, buttons.
 * @property {'horizontal' | 'vertical' | 'both'} [orientation] Which arrows move. Default 'horizontal'.
 * @property {boolean} [loop] From the last item on to the first, and back. Default true.
 * @property {(item: HTMLElement) => void} [onMove] Called with the item an arrow key moved to (after focusing it).
 */

/**
 * One Tab stop for the group `el`: its current item has tabindex 0, the others -1; arrow keys (by orientation, flipped
 * in right-to-left text), Home and End move focus between the enabled items. The current item is the one focused last,
 * else one marked aria-selected, aria-checked, aria-current or data-highlighted, else the first enabled one.
 * @param {HTMLElement} el
 * @param {RovingFocusOptions} [options]
 * @returns {() => void} Stops it.
 * @example
 * <div role="toolbar" [use]="(el) => rovingFocus(el)">…</div>
 * @see https://clarusjs.com/guide/ui-primitives#rovingfocus
 */
export function rovingFocus(el, options = {}) {
  const { items = '[role="tab"],[role="menuitem"],[role="menuitemradio"],[role="menuitemcheckbox"],[role="option"],button', orientation = 'horizontal', loop = true, onMove } = options
  const all = () => /** @type {HTMLElement[]} */ ([...el.querySelectorAll(items)])
  const enabled = () => all().filter((item) => !disabled(item))
  /** @param {HTMLElement | undefined} current */
  const settle = (current) => { for (const item of all()) item.tabIndex = item === current ? 0 : -1 }
  const marked = all().find((item) => !disabled(item) && ['aria-selected', 'aria-checked', 'aria-current', 'data-highlighted'].some((a) => item.hasAttribute(a) && item.getAttribute(a) !== 'false'))
  settle(marked ?? enabled()[0])

  /** @param {KeyboardEvent} event */
  const keydown = (event) => {
    const list = enabled()
    const at = list.indexOf(/** @type {HTMLElement} */ (event.target))
    if (at === -1) return
    const rtl = getComputedStyle(el).direction === 'rtl' || el.closest('[dir]')?.getAttribute('dir') === 'rtl'
    const keys = {
      next: [...(orientation !== 'vertical' ? [rtl ? 'ArrowLeft' : 'ArrowRight'] : []), ...(orientation !== 'horizontal' ? ['ArrowDown'] : [])],
      prev: [...(orientation !== 'vertical' ? [rtl ? 'ArrowRight' : 'ArrowLeft'] : []), ...(orientation !== 'horizontal' ? ['ArrowUp'] : [])],
    }
    let to = -1
    if (event.key === 'Home') to = 0
    else if (event.key === 'End') to = list.length - 1
    else if (keys.next.includes(event.key)) to = loop ? (at + 1) % list.length : Math.min(at + 1, list.length - 1)
    else if (keys.prev.includes(event.key)) to = loop ? (at - 1 + list.length) % list.length : Math.max(at - 1, 0)
    if (to === -1) return
    event.preventDefault()
    const item = list[to]
    settle(item)
    item?.focus()
    if (item && onMove) onMove(item)
  }
  /** @param {FocusEvent} event */
  const focusin = (event) => { if (all().includes(/** @type {HTMLElement} */ (event.target))) settle(/** @type {HTMLElement} */ (event.target)) }
  el.addEventListener('keydown', keydown)
  el.addEventListener('focusin', focusin)
  return () => {
    el.removeEventListener('keydown', keydown)
    el.removeEventListener('focusin', focusin)
  }
}
