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

### Returns

A `Resource<T>`:

- **`value`**: the last successful answer, or `initial`. It's kept while a refetch runs and after an error.
- **`loading`**: `true` while a run is in flight (not while revalidating `initial` on attach).
- **`error`**: the last run's error, or `undefined`. It's cleared when a run starts.
- **`refetch()`**: run now, cancelling a run in flight. Returns a promise that settles when the run ends.
- **`mutate(value)`**: show `value` now, for example an optimistic update. The next run replaces it.

### Caveats

- **The latest run wins.** An older run's answer is ignored, and its `signal` is aborted.
- **Interval and focus refetches skip** while a run is in flight or the page is hidden. Only `refetch()` interrupts a run.
- **On the server the fetcher never runs.** `loading` is `true` without `initial`.
- **Created in an island,** it stops when the island goes away: the request is aborted and its timers are cleared. **Created in a module** (a store), it lives as long as the page.
- **With `refetch: { onStart: false }`,** it doesn't follow its signals until its first run.
- **An `async` fetcher follows the signals it reads before its first `await`.** Signals read after it don't make it run again.

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

**Update optimistically, then confirm:**

```ts
async function rename(name) {
  user.mutate({ ...user.value, name })
  await fetch('/api/me', { method: 'PATCH', body: JSON.stringify({ name }) })
  await user.refetch()
}
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

- **Asks for the same key share a request** while it's in flight. After it settles, a new ask goes out again: answers aren't cached.
- **A key missing from the answer** rejects with `batch: no answer for "key"`. A failed request rejects every key in it.
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

`fetch(url, init)`, then the response's JSON. A response that isn't 2xx throws an `Error` naming the URL and the status (`/api/me: 503 Service Unavailable`), so `retry` and `error` see it.

```ts
const me = resource(({ signal }) => json<User>('/api/me', { signal }))
```
