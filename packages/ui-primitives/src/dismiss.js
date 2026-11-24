// dismiss: close a layer (a popover, a menu, a dialog without <dialog>) on Escape or a press outside it. Layers stack:
// Escape closes the topmost only, and a press inside a later layer isn't outside an earlier one (Radix's
// DismissableLayer). A cancelable cl:dismiss event on the layer goes first, so a page can keep it open.

/** @type {HTMLElement[]} the open layers, oldest first */
const layers = []

/**
 * @typedef {object} DismissOptions
 * @property {(reason: 'escape-key' | 'outside-press', event: Event) => void} onDismiss Close it.
 * @property {() => (Element | null | undefined)[]} [exclude] Elements whose presses aren't outside (its trigger).
 */

/**
 * Calls `onDismiss` when Escape is pressed while `el` is the topmost layer, or when a pointer goes down outside it
 * (and outside the layers opened after it, and `exclude()`). Before that, `el` gets a cancelable `cl:dismiss`
 * event (`detail.reason`); preventDefault() keeps it open.
 * @param {HTMLElement} el
 * @param {DismissOptions} options
 * @returns {() => void} Stops it (when the layer closes).
 * @example
 * @if (open) { <div [use]="(el) => dismiss(el, { onDismiss: () => (open = false) })">…</div> }
 * @see https://clarusjs.com/guide/ui-primitives#dismiss
 */
export function dismiss(el, options) {
  layers.push(el)
  /** @param {'escape-key' | 'outside-press'} reason @param {Event} event */
  const close = (reason, event) => {
    if (el.dispatchEvent(new CustomEvent('cl:dismiss', { detail: { reason }, cancelable: true }))) options.onDismiss(reason, event)
  }
  /** @param {KeyboardEvent} event */
  const keydown = (event) => {
    if (event.key !== 'Escape' || layers.at(-1) !== el) return
    close('escape-key', event)
  }
  /** @param {PointerEvent} event */
  const pointerdown = (event) => {
    const target = /** @type {Node} */ (event.target)
    const later = layers.slice(layers.indexOf(el))
    if (later.some((layer) => layer.contains(target))) return
    if ((options.exclude?.() ?? []).some((x) => x?.contains(target))) return
    close('outside-press', event)
  }
  document.addEventListener('keydown', keydown)
  document.addEventListener('pointerdown', pointerdown, true)
  return () => {
    layers.splice(layers.indexOf(el), 1)
    document.removeEventListener('keydown', keydown)
    document.removeEventListener('pointerdown', pointerdown, true)
  }
}
