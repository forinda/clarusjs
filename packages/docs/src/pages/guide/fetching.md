---
title: "Fetching data"
group: "Interactivity"
order: 9
description: "clarusjs/fetch: islands fetch their own data in the browser, in parallel, chained or batched into one request, with retry and refetch."
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

`clarusjs/fetch` is for the browser: nothing is fetched while the server renders the page. To fetch on the server, so the data is in the HTML and no JavaScript ships, `await` in a `<script server>`. It runs while the page renders (at build for a static route, per request for a server one), its imports stay on the server (`node:` modules too), and its names are there for the template.

```tscl
<script server>
  import { json } from 'clarusjs/fetch'
  const posts = await json('https://jsonplaceholder.typicode.com/posts')
</script>

@for (post of posts.slice(0, 5); track post.id) {
  <h2>{{ post.title }}</h2>
}
```

- **It doesn't make the component an island.** It runs once per render, on the server, and is gone afterwards.
- **Not in an island.** An island's own `<script>` can't `await` at the top level, and a component with a `<script server>` can't be one, or sit inside one: the island re-renders its children in the browser, where they couldn't wait. Load the data here and pass it to the island as props.
- **Not in a client route.** Its page renders in the browser. Make the route `static` or `server`.
- A page's [`load()`](/guide/routing#loading-data) does the same from a separate file, and also gets the request (`params`, `cookies`, `locals`). Use `load()` when you need those, or to share the loading between pages.

This site's [explained page](/guide/explained) uses one: it computes its numbers and awaits the commit it was built from.

### A resource with a starting value

A resource there is in its loading state, so the HTML shows your loading text and the browser fills it in. If the server already has the data, from `load()` or a `<script server>`, pass it as `initial`: the server HTML shows it, and the browser fetches again to bring it up to date.

```ts
const stats = resource(load, { initial: props.stats })
```

To skip that first browser fetch, set `refetch: { onStart: false }`. The resource then waits for a `refetch()`, its interval or a refocus, and until one of them runs it doesn't follow the signals its fetcher reads.

## What it doesn't do

- **Keep answers across full page loads:** the cache (with `key`) lives in the page; a reload starts it empty.
- **Merge different endpoints into one request:** write a server route that combines them, and batch that.
- **Mutations:** send them with `fetch` (or a form, see [Form validation](./form-validation.md)), then `refetch()` or `mutate()`.

Every option and its exact behaviour is in the [clarusjs/fetch reference](/reference/fetch).
