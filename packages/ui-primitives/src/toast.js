// Toasts: short messages any island can send with toast('Saved'); <toast-region> (once, in the layout) shows them.
// The list lives on globalThis, so every island's copy of this module shares it however the bundle is split.

/**
 * @typedef {object} ToastAction
 * @property {string} label The button's text.
 * @property {() => void} onClick Runs when it's pressed; the toast is dismissed after.
 */
/**
 * @typedef {object} Toast
 * @property {number} id
 * @property {string} message
 * @property {ToastAction} [action]
 * @property {number} duration Milliseconds shown (paused while hovered or focused); Infinity: until dismissed.
 * @property {'success' | 'error' | 'info' | 'warning'} [type] Its kind: styled by data-type, with an icon and the kind in words.
 * @property {boolean} [icon] false: no icon.
 */
/** @type {{ items: Toast[], listeners: Set<() => void>, next: number }} */
const store = /** @type {any} */ (globalThis).__clToasts ??= { items: [], listeners: new Set(), next: 1 }
const notify = () => { for (const listener of store.listeners) listener() }

/**
 * Show a message for `duration` ms (5000 by default; a toast with an action stays until dismissed, so there's time
 * to reach it), with at most one action. Polite: it never takes focus.
 * @param {string} message
 * @param {{ action?: ToastAction, duration?: number, type?: 'success' | 'error' | 'info' | 'warning', icon?: boolean }} [options]
 * @returns {number} its id, for dismissToast()
 */
export function toast(message, options = {}) {
  const id = store.next++
  store.items = [...store.items, { id, message, action: options.action, type: options.type, icon: options.icon, duration: options.duration ?? (options.action ? Infinity : 5000) }]
  notify()
  return id
}

/** @param {number} id */
export function dismissToast(id) {
  store.items = store.items.filter((t) => t.id !== id)
  notify()
}

/** Every toast, oldest first. @returns {Toast[]} */
export const toasts = () => store.items

/** Calls `listener` now and on every change; returns how to stop. @param {() => void} listener */
export function subscribeToasts(listener) {
  store.listeners.add(listener)
  listener()
  return () => { store.listeners.delete(listener) }
}

/** Removes every toast (tests, or a page that resets). */
export function clearToasts() {
  store.items = []
  notify()
}
