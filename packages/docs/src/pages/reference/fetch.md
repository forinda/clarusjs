---
title: "clarusjs/fetch"
group: "APIs"
order: 2
description: "resource(), batch() and json(): the exact contract of each, with parameters, return values, caveats and usage."
---

# clarusjs/fetch

<p class="lead">Data an island fetches itself, in the browser. For the how-to with a live dashboard, see <a href="/guide/fetching">Fetching data</a>.</p>

```ts
import { resource, batch, json } from 'clarusjs/fetch'
```

## resource()

```ts
resource<T>(fetcher, options?): Resource<T>
```

Runs `fetcher` and gives its answer as `value`, `loading` and `error`. It runs again when a signal the fetcher reads changes.

### Parameters

- **`fetcher({ signal })`**: returns the value, or a promise of it; it can be `async`. Return `undefined`, `null` or `false` for "not ready": no request is sent. An async fetcher resolving to `undefined` is "not ready" too, and the last value is kept. Pass `signal` on to `fetch`, so a superseded or abandoned request is cancelled. The fetcher runs in an effect, so it re-runs when a signal it reads changes.
- **`options`** (optional):
  - **`initial`**: the starting value, such as data from the page's `load()`. It's shown in the server HTML, and `loading` is false while the browser fetches again.
  - **`retry`**: how many more attempts after a failure (default `0`), or `{ count, delay(attempt) }`. The default delay is 500 ms, doubling, at most 8 s.
  - **`refetch`**:
    - **`interval`** (ms): run again on this interval while the page is visible;
    - **`focus`**: run again when the page is shown again;
    - **`onStart`** (default `true`): run when the island attaches.
  - **`key`**: a function returning the cache key, an array such as `['items', { page }]`. Answers are cached by it and shared by every resource on the page; a key seen before is served without a request until it's invalidated. A falsy key means "not ready". See [Caching](#caching).
  - **`stale`** (ms, with `key`): a cached answer older than this is fetched again when used. Unset: fresh until invalidated. `0`: always fetched.
  - **`keep`** (ms, with `key`, default 5 minutes): how long an answer nothing shows stays cached.

### Returns

A `Resource<T>`:

- **`value`**: the last successful answer, or `initial`. It's kept while a refetch runs and after an error.
- **`loading`**: `true` while a run is in flight (not while revalidating `initial` on attach).
- **`error`**: the last run's error, or `undefined`. It's cleared when a run starts.
- **`refetch()`**: run now, cancelling a run in flight. Returns a promise that settles when this run ends (with its retries), or when a newer run replaces it.
- **`mutate(value)`**: show `value` now, for example an optimistic update. The next run replaces it.
- **`ready()`**: a promise of the first answer. It resolves with `value` once there is one (at once if there already is), or rejects with the first run's error. On the server it resolves with `initial`. Use it in an event handler or an async function: a script's top level can't `await`.

### Caveats

- **The latest run wins.** An older run's answer is ignored, and its `signal` is aborted.
- **Interval and focus refetches skip** while a run is in flight or the page is hidden. Only `refetch()` interrupts a run.
- **On the server the fetcher never runs.** `loading` is `true` without `initial`.
- **Created in an island,** it stops when the island goes away: the request is aborted and its timers are cleared. **Created in a module** (a store), it lives as long as the page.
- **With `refetch: { onStart: false }`,** it doesn't follow its signals until its first run.
- **An `async` fetcher follows the signals it reads before its first `await`.** Signals read after it don't make it run again. An async "not ready" still shows `loading` for a moment (the fetcher has to run to say so); for a chain, the synchronous form (`team.value && json(…)`) doesn't.
- **Reading the resource inside its own fetcher** (a guard on `loading`, a cursor from `value` for "load more") doesn't subscribe it to itself. Declare it with `let` first: the first run happens inside `resource()`, before a `const` is assigned.

### Usage

**Show loading, error and data:**

```tscl
<script>
  import { json, resource } from 'clarusjs/fetch'
  const user = resource(({ signal }) => json('/api/me', { signal }))
</script>
@if (user.value) { <p>{{ user.value.name }}</p> }
@else if (user.error) { <p>Couldn't load. <button (click)="user.refetch()">Retry</button></p> }
@else { <p>Loading…</p> }
```

**Wait for another resource (a chain):**

```ts
const members = resource(({ signal }) => team.value && json(`/api/teams/${team.value.id}/members`, { signal }))
```

**Write it with async/await:**

```ts
const members = resource(async ({ signal }) => {
  const id = team.value?.id
  if (id === undefined) return            // not ready: resolves to undefined
  const res = await fetch(`/api/teams/${id}/members`, { signal })
  if (!res.ok) throw new Error(`members: ${res.status}`)
  return res.json()
})
```

**Follow a state (a page number, a search box):**

```ts
let page = state(1)
const results = resource(({ signal }) => json(`/api/items?page=${page}`, { signal }))
```

**Poll, and retry a flaky endpoint:**

```ts
const prices = resource(load, { retry: 3, refetch: { interval: 10_000 } })
```

**Start from the server's data:**

```ts
const stats = resource(load, { initial: props.stats })
```

**Wait for the data in code:**

```ts
async function exportCsv() {
  const rows = await items.ready()   // the first answer, fetched or already there
  download(toCsv(rows))
}
```

**Update optimistically, then confirm:**

```ts
async function rename(name) {
  user.mutate({ ...user.value, name })
  await fetch('/api/me', { method: 'PATCH', body: JSON.stringify({ name }) })
  await user.refetch()
}
```

## Caching

With `key`, a resource's answers live in a cache shared by the whole page.

- **A key seen before is served without a request,** until `invalidate()` matches it, or it's older than `stale`. `refetch()` always asks.
- **Keys are compared by value**, object properties in any order: `['items', { page: 2, q: '' }]` and `['items', { q: '', page: 2 }]` are one key. Put in the key everything the request depends on: on a cached answer the fetcher doesn't run.
- **Keys are plain values:** strings, numbers, booleans, `null`, arrays and plain objects. They're compared as JSON is written: a property set to `undefined` is left out, and a `Map`, `Set` or class instance becomes `{}`, so two of them would share one entry.
- **One key, one kind of data.** Resources sharing a key share its answer, whatever their fetchers; nothing checks that they fetch the same thing.
- **One request per key at a time.** Resources asking a key that's already loading wait for that request. It ends even if the resource that started it moves on.
- **Moving to another key keeps the previous value** on screen, with `loading` true, until the new answer arrives.
- **`initial` with `key`** fills the entry if it's empty, as fresh: no browser request until it's invalidated.
- **`mutate(value)`** on a keyed resource writes its entry, so every resource showing it updates.
- **An error isn't cached:** the entry keeps its last answer, and the next use fetches again.
- **Memory:** an answer nothing shows is dropped after `keep`. The cache lives in the page: it survives fragment navigation, not a full reload. On the server there's no cache.

## invalidate()

```ts
invalidate(prefix?: unknown[]): void
```

Marks every cached answer whose key starts with `prefix` as stale. The resources showing one fetch it again now; the others fetch when next used.

### Parameters

- **`prefix`** (optional): the key's first elements. `['items']` matches `['items', { page: 1 }]` and `['items', 'archived']`, not `['itemsArchive']` nor `['other', 'items']`. Without it, everything.

### Caveats

- **A request in flight when you invalidate** isn't stored when it ends: the resources showing the key make a fresh one (one request for all of them), and a resource opening the key later fetches too.

### Usage

```ts
async function rename(id, name) {
  await fetch(`/api/items/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) })
  invalidate(['items'])
}
```

## setData()

```ts
setData<T>(key: unknown[], value: T | ((prev: T | undefined) => T)): void
```

Sets a cached answer, and shows it in every resource using that key. Creates the entry if it's missing.

### Usage

**An optimistic edit, confirmed by the server:**

```ts
async function rename(id, name) {
  setData(['items', { page }], (data) => data && { ...data, rows: data.rows.map((r) => (r.id === id ? { ...r, name } : r)) })
  try {
    await fetch(`/api/items/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) })
  } finally {
    invalidate(['items']) // the server's version wins, also if the request failed
  }
}
```

## prefetch()

```ts
prefetch<T>(key: unknown[], fetcher): Promise<void>
```

Fetches an answer into the cache ahead of time, unless it's there and not invalidated (a resource's `stale` isn't considered here). The promise settles when it's stored. Errors are ignored: the resource that opens the key later fetches again.

### Usage

**The next page, while this one is shown:**

```ts
effect(() => {
  if (list.value && page < list.value.pages)
    prefetch(['records', { page: page + 1 }], ({ signal }) => json(`/api/records?page=${page + 1}`, { signal }))
})
```

## batch()

```ts
batch<T>(load, options?): { get(key): Promise<T> }
```

Sends the keys asked at the same moment as one request, from any island on the page.

### Parameters

- **`load(keys, { signal })`**: fetch the answers for `keys`. Return an object with one entry per key (or a promise of it).
- **`options`** (optional):
  - **`wait`** (ms): collect keys for this long. By default, until the current task ends.
  - **`max`**: at most this many keys per request; more are split.

### Returns

`{ get(key) }`. `get` returns a promise of that key's answer.

### Caveats

- **The islands asking in the same task share a request** (those attaching as the page loads). Islands that attach later, on idle or when visible, send their own unless `wait` covers them.
- **Asks for the same key share a request** while it's in flight. After it settles, a new ask goes out again: answers aren't cached.
- **A key missing from the answer** rejects with `batch: no answer for "key"`, as does every key when the answer isn't an object. A failed request rejects every key in it.
- **`max` below 1** counts as 1.
- **Once sent, a request runs to the end,** even if the islands that asked have gone (others may be waiting on it).

### Usage

```ts
// src/stores/stats.ts: shared, so every card on the page joins the same request
export const stats = batch((keys, { signal }) => json(`/api/stats?keys=${keys.join(',')}`, { signal }))
```

```ts
// in each card's script
const stat = resource(() => stats.get(key))
```

## json()

```ts
json<T = any>(url, init?): Promise<T>
```

`fetch(url, init)`, then the response's JSON. A response that isn't 2xx throws an `Error` naming the URL and the status (`/api/me: 503 Service Unavailable`), with the code in its `status` property, so `retry` and `error` see it (`if (user.error?.status === 404) …`). `T` defaults to `any`, as `Response.json()` does.

```ts
const me = resource(({ signal }) => json<User>('/api/me', { signal }))
```
