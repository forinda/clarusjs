---
title: "Fetching data"
group: "Interactivity"
order: 9
description: "clarusjs/fetch: islands fetch their own data in the browser, in parallel, chained or batched, any response type, with retry, refetch, timeouts, cancelling and error callbacks."
---

# Fetching data

<p class="lead">A page's <code>load()</code> gives it data on the server. For data an island fetches itself in the browser (on demand, after a click, by polling, or data that changes after the page was built) use <code>clarusjs/fetch</code>.</p>

This dashboard is three kinds of islands. The stat cards share one batch, so the three of them make **one** request. The user panel and the activity feed share the signed-in user. The feed waits for it, and the demo server fails its first request so you can see the retry. Reload the page to watch it again.

<div class="demo-row">
  <statCard [key]="'visits'" [label]="'Visits'" />
  <statCard [key]="'signups'" [label]="'Signups'" />
  <statCard [key]="'revenue'" [label]="'Revenue'" [money]="true" />
</div>

<userPanel />

<activityFeed />

## A resource

`resource()` runs a fetcher and gives an island its answer: `value`, `loading` and `error`. They update the island's template on their own.

```tscl
<script>
  import { json, resource } from 'clarusjs/fetch'
  const users = resource(({ signal }) => json('/api/users', { signal }))
</script>

@if (users.value) {
  <ul>@for (u of users.value; track u.id) { <li>{{ u.name }}</li> }</ul>
} @else if (users.error) {
  <p>Couldn't load the users. <button (click)="users.refetch()">Try again</button></p>
} @else {
  <p>Loading…</p>
}
```

Pass the `signal` on to `fetch` (as `json()` does). When a newer request starts, or the island goes away, the old one is cancelled.

## Requests in parallel and in a chain

Resources start together, in parallel. A resource whose fetcher reads another one's `value` waits for it. Until the value is there, the fetcher returns `undefined` (or `null`, or `false`), which means "not ready" and sends no request. When the value changes, the resource runs again, so a chain is just a fetcher reading a signal:

```ts
const team = resource(({ signal }) => json('/api/team', { signal }))
const members = resource(({ signal }) => team.value && json(`/api/teams/${team.value.id}/members`, { signal }))
```

The same goes for any `state`: change a page number, and a resource that reads it fetches that page.

Fetchers can be `async`. Read the signals it depends on **before** its first `await`: those are the ones it follows. To wait, return nothing (`return`), which an async fetcher resolves to `undefined`, meaning "not ready". (For a chain, the `team.value && …` form above is smoother: an async fetcher shows `loading` for a moment even when it isn't ready.)

```ts
const members = resource(async ({ signal }) => {
  const id = team.value?.id          // read before awaiting: followed
  if (id === undefined) return       // not ready yet
  const res = await fetch(`/api/teams/${id}/members`, { signal })
  if (!res.ok) throw new Error(`members: ${res.status}`)
  return res.json()
})
```

## One request for many islands

When several islands ask the same endpoint for different keys, `batch()` sends the keys asked at the same moment (the islands attaching as the page loads) as one request. Share it from a module:

```ts
// src/stores/stats.ts
import { batch, json } from 'clarusjs/fetch'
export const stats = batch((keys, { signal }) => json(`/api/stats?keys=${keys.join(',')}`, { signal }))
```

```tscl
@input key: string
<script>
  import { resource } from 'clarusjs/fetch'
  import { stats } from '../stores/stats.ts'
  const stat = resource(() => stats.get(key))
</script>
<p>{{ stat.value ?? '…' }}</p>
```

The endpoint answers with one value per key (`{ "visits": 12400, "signups": 318 }`). A key missing from the answer fails that card only.

## Retry and refetch

```ts
const feed = resource(load, {
  retry: 2,                                   // two more attempts: after 500 ms, then 1 s
  refetch: { interval: 30_000, focus: true }, // every 30 s while the page is visible, and when it's shown again
})
```

`refetch()` runs it now, for a Refresh button or after you've saved something. In code that needs the data itself, `await items.ready()` waits for the first answer (in a handler or an async function; a script's top level can't `await`). `mutate(value)` shows a value right away (an optimistic update); the next run replaces it.

## Any response, and sending data

`json()` reads JSON. `request()` reads whatever the server sends, by its `Content-Type`: JSON (`application/json`, and `+json` types such as `application/problem+json`), text (`text/*` and XML), or else a `Blob`. A `204` gives `undefined`. To choose yourself, pass `as`: `'json'`, `'text'`, `'blob'`, `'arrayBuffer'`, `'formData'`, `'stream'` (the body as a `ReadableStream`) or `'response'` (the `Response` itself).

```ts
const csv = await request<string>('/api/export')                // text/csv: read as text
const photo = await request<Blob>(`/api/photos/${id}`)          // image/png: a Blob
const rows = await request('/api/feed', { parse: { 'application/x-ndjson': ndjson } }) // your own reader
```

A plain object or array as `body` is sent as JSON, with `Content-Type: application/json` unless you set one. `FormData`, `URLSearchParams`, a `Blob` or a string go as `fetch` sends them.

```ts
await request(`/api/posts/${id}`, { method: 'PATCH', body: { title } })
```

A response that isn't 2xx throws, whatever you asked to read. The error has the `status` and the body read the same way, as `data`, so a `422`'s field errors are at hand (`e.data.errors`).

## With axios, ky or your own client

`resource()` and `action()` take any function that returns a promise, so an HTTP client you already use works as it is. Two things to carry over:

- **Pass `signal` on.** It's how a newer run, `abort()`, `timeout` and an island going away cancel the request. axios, ky and `fetch` all take an `AbortSignal` as `signal`.
- **Let errors throw.** `retry`, `error` and `onError` see whatever the client throws. axios throws an `AxiosError` for a non-2xx response, with the status at `error.response.status`, where `request()` puts it at `error.status`.

```ts
// api.ts: one client for the site, with its own base URL and interceptors (auth, logging)
import axios from 'axios'
export const api = axios.create({ baseURL: '/api' })
api.interceptors.request.use((config) => ({ ...config, headers: { ...config.headers, 'x-client': 'web' } }))
```

```tscl
<script>
  import { action, configure, invalidate, resource } from 'clarusjs/fetch'
  import { api } from '~/api.ts'
  const posts = resource(({ signal }) => api.get('/posts', { signal }).then((res) => res.data), { key: () => ['posts'] })
  const remove = action((id, { signal }) => api.delete(`/posts/${id}`, { signal }), {
    onSuccess: () => invalidate(['posts']),
    onError: (e) => { if (e.response?.status === 404) return false }, // gone already: no toast
  })
</script>
```

In `configure()`'s handlers, read the status the way your client reports it (`e.response?.status` for axios, `e.status` for `request()`). Whatever the client throws when its `signal` aborts (axios: `CanceledError`), a cancel is still no error and no callbacks, and a `timeout` is still a `TimeoutError`.

## Actions: save, delete, like

`resource()` reads. For a one-off call from a button, use `action()`: it gives `pending`, `error` and `result` for the template, and runs the request when you call `run()`.

```tscl
<script>
  import { action, invalidate, request } from 'clarusjs/fetch'
  const remove = action((id, { signal }) => request(`/api/posts/${id}`, { method: 'DELETE', signal }), {
    meta: { success: 'Deleted' },          // for configure()'s toast
    onSuccess: () => invalidate(['posts']), // the lists showing posts fetch again
  })
</script>

<button (click)="remove.run(post.id)" [disabled]="remove.pending">Delete</button>
@if (remove.error) { <p role="alert">Couldn't delete it.</p> }
```

- **`run(input)` never rejects.** A failure lands in `error`, `onError` and `configure()`'s handler, so a click can't leave an unhandled error. **`runAsync(input)`** rejects, for `try`/`catch` or `await`ing one action after another.
- **A second call while one runs joins it**: one request, the same answer, no double submit. With `concurrency: 'latest'`, it cancels the one in flight instead (a search as you type).
- **`abort()`, `timeout`, the callbacks and `meta`** work as they do for a resource. Created in an island, a call in flight is cancelled when the island goes away.
- **Optimistic updates:** change what's shown first (`setData()` or a resource's `mutate()`), and put it back in `onError`.

The caching demo below renames a record with an action: the button says *Renaming…* while it runs.

## Cancelling and timeouts

`abort()` cancels a resource's run in flight. That isn't a failure: `loading` goes back to false, the last value stays, and `error` stays empty. `timeout` (ms) fails a run that takes too long, retries included, with a `TimeoutError`. That one is an error. `request()` takes `timeout` too, on top of the `signal` you pass.

<exportDemo />

```tscl
<script>
  import { request, resource } from 'clarusjs/fetch'
  const csv = resource(({ signal }) => request('/api/export', { signal }), {
    refetch: { onStart: false }, // waits for the button
    timeout: 2500,
  })
</script>

<button (click)="csv.refetch()" [disabled]="csv.loading">Export CSV</button>
<button (click)="csv.abort()" [disabled]="!csv.loading">Cancel</button>
```

## Errors

Use whichever fits:

- **State in the template.** `error` holds the last run's error, until the next run starts: `@if (feed.error) { … }`.
- **Callbacks, once per request.** `onSuccess(value)`, `onError(error)` and `onSettled(value, error)`. They are events: the same error twice calls `onError` twice, which is what a toast wants. A cancel calls none of them; with `retry`, `onError` runs after the last attempt.
- **One place for toasts.** `configure()` sets handlers that run after every resource's and action's own callbacks, with its `meta`. An own `onError` returning `false` skips them (it handled the error).
- **An effect, for something that lasts.** A banner shown while an error stands: `effect(() => banner.set(feed.error ? 'Offline' : ''))`.

```ts
// once, in a module every island imports (a store)
configure({
  onError: (e, { meta }) => { if (!meta?.silent) toast.error(String(e)) },
  onSuccess: (_, { meta }) => { if (meta?.success) toast(String(meta.success)) },
})

const stats = resource(load, { meta: { silent: true } })        // no toast for this one
const feed = resource(load, { onError: () => false })           // handled here instead
```

## Caching

Give a resource a `key`, and its answers are cached by it: a key seen before comes back without a request. This list has 20,000 records, 10 per page. Go forward and back: pages you've seen don't ask the server again, the next page is fetched ahead, and the previous page stays on screen while a new one loads. **Rename the first row** changes a record, then invalidates every cached page.

<recordList />

```tscl
<script>
  import { invalidate, json, prefetch, resource } from 'clarusjs/fetch'
  let page = state(1)
  let q = state('')
  const list = resource(({ signal }) => json(`/api/records?page=${page}&q=${encodeURIComponent(q)}`, { signal }), {
    key: () => ['records', { page: page, q: q }],   // one cache entry per page and filter
  })
  async function rename(id, name) {
    await fetch(`/api/records/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) })
    invalidate(['records'])                          // every cached page: the visible one refetches now
  }
</script>
```

- **Fresh until invalidated.** A cached answer is used until `invalidate()` matches its key. For data other people change often, add `stale: 30_000`: an answer older than that is fetched again when used.
- **The key is the cache's name for the request.** Put in it everything the request depends on (the page, the filter), and keep it to plain values: `{ page, q }` and `{ q, page }` are the same key.
- **Shared.** Resources with the same key, in any island on the page, share one entry and one request.
- **`invalidate(prefix)`** matches keys element by element: `invalidate(['records'])` matches `['records', { page: 2 }]`, not `['recordsArchive']`.
- **`setData(key, fn)`** changes a cached answer right away (an optimistic edit); **`prefetch(key, fetcher)`** fetches one ahead.
- **Memory.** An answer nothing shows is dropped after 5 minutes (`keep`). The cache lives in the page: it survives [fragment navigation](./fragment-navigation.md), not a full reload.

## On the server

Nothing is fetched while the server renders the page. A resource there is in its loading state, so the HTML shows your loading text and the browser fills it in. If the page's `load()` already has the data, pass it as `initial`: the server HTML shows it, and the browser fetches again to bring it up to date.

```ts
const stats = resource(load, { initial: props.stats })
```

To skip that first browser fetch, set `refetch: { onStart: false }`. The resource then waits for a `refetch()`, its interval or a refocus, and until one of them runs it doesn't follow the signals its fetcher reads.

## What it doesn't do

- **Keep answers across full page loads:** the cache (with `key`) lives in the page; a reload starts it empty.
- **Merge different endpoints into one request:** write a server route that combines them, and batch that.
- **Progress:** there's no upload or download progress. For a progress bar, read `as: 'stream'` and count the chunks yourself.

Every option and its exact behaviour is in the [clarusjs/fetch reference](/reference/fetch).
