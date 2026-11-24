// focusReturn: when a popup, menu or dialog goes, focus goes back to where it was when it opened (its trigger).

/**
 * Remember what has focus now; the returned function puts focus back there, if it's still on the page and focus is in
 * `el` or nowhere (a click elsewhere keeps its own focus).
 * @param {HTMLElement} el
 * @returns {() => void}
 * @example
 * @if (open) { <div [use]="focusReturn">…</div> }
 * @see https://clarusjs.com/guide/ui-primitives#focusreturn
 */
export function focusReturn(el) {
  const before = /** @type {HTMLElement | null} */ (document.activeElement)
  return () => {
    const now = document.activeElement
    if (before?.isConnected && (!now || now === document.body || el.contains(now))) before.focus()
  }
}
