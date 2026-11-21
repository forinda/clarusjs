---
title: "Fetching data"
group: "Interactivity"
order: 9
description: "clarusjs/fetch: islands fetch their own data in the browser, in parallel, chained or batched into one request, with retry and refetch."
---
@import statCard from '~/components/stat-card.tscl'
@import userPanel from '~/components/user-panel.tscl'
@import activityFeed from '~/components/activity-feed.tscl'

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

`refetch()` runs it now, for a Refresh button or after you've saved something. `mutate(value)` shows a value right away (an optimistic update); the next run replaces it.

## On the server

Nothing is fetched while the server renders the page. A resource there is in its loading state, so the HTML shows your loading text and the browser fills it in. If the page's `load()` already has the data, pass it as `initial`: the server HTML shows it, and the browser fetches again to bring it up to date.

```ts
const stats = resource(load, { initial: props.stats })
```

To skip that first browser fetch, set `refetch: { onStart: false }`. The resource then waits for a `refetch()`, its interval or a refocus, and until one of them runs it doesn't follow the signals its fetcher reads.

## What it doesn't do

- **Keep answers between requests:** two islands asking at the same moment share one request, but a later ask goes to the server again.
- **Merge different endpoints into one request:** write a server route that combines them, and batch that.
- **Mutations:** send them with `fetch` (or a form, see [Form validation](./form-validation.md)), then `refetch()` or `mutate()`.

Every option and its exact behaviour is in the [clarusjs/fetch reference](/reference/fetch).
