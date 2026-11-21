// A promise to settle by hand, and a flush of pending microtasks and promise callbacks.
export function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}
export const flush = () => new Promise((r) => setTimeout(r, 0))
