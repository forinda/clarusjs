// typeahead: typing letters moves to the item that starts with them (a menu, a listbox). Ported from Radix's
// getNextMatch: the search starts after the current item, and a key repeated ("bbb") cycles through the items
// starting with it.

/**
 * @typedef {object} TypeaheadOptions
 * @property {string} [items] Which descendants are the items (a selector). Default: menu items and options.
 * @property {(item: HTMLElement) => void} [onMatch] What to do with the match. Default: focus it.
 * @property {(item: HTMLElement) => string} [text] An item's text to match. Default: its textContent.
 * @property {number} [timeout] How long a pause ends the search, in ms. Default 500.
 */

/**
 * Typing a character in `el` moves to the next item whose text starts with what was typed since the last pause.
 * @param {HTMLElement} el
 * @param {TypeaheadOptions} [options]
 * @returns {() => void} Stops it.
 * @example
 * <ul role="listbox" [use]="[(el) => rovingFocus(el, { orientation: 'vertical' }), (el) => typeahead(el)]">…</ul>
 * @see https://clarusjs.com/guide/ui-primitives#typeahead
 */
export function typeahead(el, options = {}) {
  const { items = '[role="menuitem"],[role="menuitemradio"],[role="menuitemcheckbox"],[role="option"],li', timeout = 500 } = options
  const text = options.text ?? ((/** @type {HTMLElement} */ item) => item.textContent?.trim() ?? '')
  const onMatch = options.onMatch ?? ((/** @type {HTMLElement} */ item) => item.focus())
  let search = ''
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer
  /** @param {KeyboardEvent} event */
  const keydown = (event) => {
    if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return
    if (event.key === ' ' && !search) return // a space starts nothing: it activates the item
    clearTimeout(timer)
    timer = setTimeout(() => (search = ''), timeout)
    search += event.key.toLowerCase()
    const list = /** @type {HTMLElement[]} */ ([...el.querySelectorAll(items)]).filter((item) => !item.hasAttribute('disabled') && item.getAttribute('aria-disabled') !== 'true')
    const current = list.indexOf(/** @type {HTMLElement} */ (document.activeElement))
    // "bbb" is "b" pressed three times: cycle through the b's rather than search for "bbb".
    const repeated = [...search].every((ch) => ch === search[0])
    const query = repeated ? search[0] : search
    // From the item after the current one (from the current one while still typing a longer search), around.
    const from = repeated || current === -1 ? current + 1 : current
    const order = list.map((_, i) => list[(from + i) % list.length])
    const match = order.find((item) => item && text(item).toLowerCase().startsWith(/** @type {string} */ (query)))
    if (!match) return
    event.preventDefault()
    if (match !== document.activeElement) onMatch(match)
  }
  el.addEventListener('keydown', keydown)
  return () => {
    clearTimeout(timer)
    el.removeEventListener('keydown', keydown)
  }
}
