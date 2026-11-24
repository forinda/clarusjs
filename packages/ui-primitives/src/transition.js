// enter and exit: Base UI's state attributes for CSS transitions. data-open / data-closed say the state;
// data-starting-style is there for the first frame of opening, so a transition from it runs; data-ending-style while
// closing, until the element's animations finish. Style them:
//   .popup { transition: opacity 150ms } .popup[data-starting-style], .popup[data-ending-style] { opacity: 0 }

const frame = () => new Promise((done) => requestAnimationFrame(() => done(undefined)))

/**
 * Mark `el` open, with data-starting-style for its first frame so CSS transitions run from there. An element rendered
 * open on the server doesn't need it (nothing to animate in).
 * @param {HTMLElement} el
 * @returns {Promise<void>} When the starting style is gone.
 * @example
 * @if (open) { <div class="popup" [use]="enter">…</div> }
 * @see https://clarusjs.com/guide/ui-primitives#enter-and-exit
 */
export async function enter(el) {
  el.removeAttribute('data-closed')
  el.removeAttribute('data-ending-style')
  el.setAttribute('data-open', '')
  el.setAttribute('data-starting-style', '')
  await frame()
  await frame() // the start has been styled: now transition from it
  el.removeAttribute('data-starting-style')
}

/**
 * Mark `el` closing: data-closed and data-ending-style, until its animations and transitions finish. Remove or hide
 * it after: `await exit(el)`.
 * @param {HTMLElement} el
 * @returns {Promise<void>}
 * @see https://clarusjs.com/guide/ui-primitives#enter-and-exit
 */
export async function exit(el) {
  el.removeAttribute('data-open')
  el.setAttribute('data-closed', '')
  el.setAttribute('data-ending-style', '')
  await frame() // the ending style applies, and its transitions start
  await Promise.allSettled((el.getAnimations?.() ?? []).map((a) => a.finished))
  el.removeAttribute('data-ending-style')
}
