/**
 * True in the browser, false on the server. A component's script runs in both (the server renders it, the browser
 * attaches it), so code that needs the DOM, timers that keep running or listeners on `window` goes under
 * `if (browser) { … }`. A window without a document (some server runtimes define one) is the server.
 * @example
 * ```ts
 * if (browser) {
 *   const timer = setInterval(tick, 1000)
 *   onDispose(() => clearInterval(timer))
 * }
 * ```
 * @see https://clarusjs.com/reference/runtime#browser
 */
export const browser: boolean = typeof window !== 'undefined' && typeof document !== 'undefined'
