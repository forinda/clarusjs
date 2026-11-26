---
title: "Fetching recipes"
group: "Interactivity"
order: 10
description: "Complete fetching patterns to copy: search as you type, load more, polling, optimistic updates, chains, token refresh, retry, prefetch on hover, uploads, and external APIs."
---

# Fetching recipes

<p class="lead">Whole patterns, each one live below its code. They use <a href="/guide/fetching"><code>clarusjs/fetch</code></a>: <code>resource()</code> to read, <code>action()</code> to change, <code>request()</code> for any response. Every one is a single island you can copy.</p>

## Search as you type

Wait until typing pauses, then search. A newer search aborts the request still in flight, so a slow answer to an older search never replaces the newer one.

```tscl
<script>
  import { json, resource } from 'clarusjs/fetch'
  let query = state('')
  let term = state('')
  let timer
  function type(text) {
    query = text
    clearTimeout(timer)
    timer = setTimeout(() => (term = text.trim()), 250)
  }
  const results = resource(({ signal }) => (term ? json('/api/cities?q=' + encodeURIComponent(term), { signal }) : false))
</script>

<input type="search" [value]="query" (input)="type($event.target.value)" />
@if (term && results.value) { <ul>@for (city of results.value; track city.value) { <li>{{ city.label }}</li> }</ul> }
```

<recipeSearch />

A fetcher returning `false` means "not ready": nothing is asked while the field is empty. A `key` would cache each search by its words, but a keyed request is shared by every resource showing it, so a newer search doesn't abort it: keep the key off where cancelling matters. For a field that picks from the results, see the [combobox](/guide/forms#a-combobox).

## Load more

Keep the rows in state and add each page's to them. The resource runs again when `page` changes; `onSuccess` appends and remembers the last page that arrived, so a failed page is tried again, never skipped.

```tscl
<script>
  import { json, resource } from 'clarusjs/fetch'
  let page = state(1)
  let loaded = state(0)
  let rows = state([])
  let pages = state(1)
  const batch = resource(({ signal }) => json('/api/records?page=' + page + '&size=5', { signal }), {
    onSuccess: (data) => {
      rows = [...rows, ...data.rows]
      pages = data.pages
      loaded = page
    },
  })
</script>

<ul>@for (row of rows; track row.id) { <li>{{ row.name }}</li> }</ul>
@if (batch.error) {
  <p role="alert">Couldn't load page {{ page }}.</p> <button (click)="batch.refetch()">Try again</button>
} @else if (loaded < pages) {
  <button [disabled]="batch.loading" (click)="page = loaded + 1">{{ batch.loading ? 'Loading…' : 'Load more' }}</button>
}
```

<recipeLoadMore />

For numbered pages instead, show `batch.value.rows` and give the resource a `key` (`['records', page]`): pages already seen come from the cache. [Caching](/guide/fetching#caching) has a live example.

## Polling

`refetch.interval` asks again every so often, while the page is visible; `refetch.focus` asks when it's shown again. A run in flight isn't interrupted.

```ts
const clock = resource(({ signal }) => json('/api/clock', { signal }), { refetch: { interval: 2000, focus: true } })
```

<recipePoll />

## Optimistic update, with rollback

Show the change at once, send it, and put it back if the server says no. `mutate()` sets what the resource shows; the action's `onError` undoes it.

```tscl
<script>
  import { action, json, request, resource } from 'clarusjs/fetch'
  const likes = resource(({ signal }) => json('/api/likes', { signal }))
  const like = action((_, { signal }) => request('/api/likes', { method: 'POST', signal }), {
    onSuccess: (data) => likes.mutate(data), // the server's count
    onError: () => likes.mutate({ likes: likes.value.likes - 1 }), // roll back
  })
  function tap() {
    likes.mutate({ likes: likes.value.likes + 1 }) // shown now
    like.run()
  }
</script>

<button [disabled]="!likes.value || like.pending" (click)="tap()">♥ {{ likes.value?.likes }}</button>
```

<recipeOptimistic />

## A feed: posts and likes, optimistic

A new post shows at once, marked as on its way, and a like flips at once. The server's answer replaces them; a failure takes them back and says why. Each post and each like is its own call and several can be on their way at once, so they're plain `async` functions with `try`/`catch` rather than an `action()` (a second call to one action joins the first).

```tscl
<script>
  import { json, request, resource } from 'clarusjs/fetch'
  const feed = resource(({ signal }) => json('/api/posts', { signal }))
  let temp = 0 // ids for posts on their way: unique, even for two in the same millisecond
  let liking = state([]) // posts with a like on its way
  // Swap the post with this id for another, or for nothing.
  const replace = (id, post) => feed.mutate({ posts: feed.value.posts.flatMap((p) => (p.id === id ? (post ? [post] : []) : [p])) })
  async function post(text) {
    const pending = { id: 'new-' + ++temp, text, likes: 0, liked: false, pending: true }
    feed.mutate({ posts: [pending, ...feed.value.posts] }) // shown now
    try {
      replace(pending.id, await request('/api/posts', { method: 'POST', body: { text } })) // the server's copy, with its id
    } catch (e) {
      replace(pending.id, null) // taken back
    }
  }
  async function toggle(post) {
    if (liking.includes(post.id)) return // one at a time per post
    const on = !post.liked
    replace(post.id, { ...post, liked: on, likes: post.likes + (on ? 1 : -1) }) // shown now
    liking = [...liking, post.id]
    try {
      replace(post.id, await request('/api/posts', { method: 'POST', body: { like: post.id, on } }))
    } catch (e) {
      replace(post.id, post) // back to how it was
    } finally {
      liking = liking.filter((id) => id !== post.id)
    }
  }
</script>
```

The roll back puts back the post as it was when the call started (`post`), not "one less". That holds only if nothing else changed the post meanwhile, so a post takes one like at a time (`liking`, and its button is `[disabled]` while one is on its way); different posts' likes still run at once. A failed post's text goes back into the box only if the box is still empty, so a newer draft isn't lost. Try it, then make the server fail and post or like again:

<recipeFeed />

## Editing a profile: save, or roll back

The form starts from the saved profile, and the page shows the new values as soon as you save. Saved, they become the form's values and new starting point (`f.reset(saved)`), so `f.dirty` is false again; the fields are disabled while the request is on its way (`saving`, set in `submit`), since the answer would overwrite edits typed meanwhile. Not `f.submitting`: that starts before the checks, and a disabled field isn't checked. Failed, what the page shows goes back to what was saved, and the form keeps your edits to try again, or to undo with `f.reset()`. An error the server returns for a field lands on that field ([Form validation](/guide/form-validation#submit)).

```tscl
<script>
  import { form } from 'clarusjs/forms'
  import { json, request, resource } from 'clarusjs/fetch'
  let edit = state({ name: '', bio: '' })
  let saving = state(false)
  const f = form(edit, {
    async submit(values) {
      const before = profile.value
      profile.mutate(values) // shown now
      saving = true
      try {
        const saved = await request('/api/profile', { method: 'PUT', body: values })
        profile.mutate(saved)
        f.reset(saved) // the new starting point
      } catch (e) {
        profile.mutate(before) // roll back
        if (e.data?.errors) return { errors: e.data.errors } // on their fields
      } finally {
        saving = false
      }
    },
  })
  // Loaded, the profile is the form's values and its starting point.
  const profile = resource(({ signal }) => json('/api/profile', { signal }), { onSuccess: (p) => f.reset(p) })
</script>

<form [engine]="f">
  <fieldset [disabled]="saving">{{-- no edits while it saves: the answer would overwrite them --}}
    <label>Name <input required [(value)]="edit.name"> <small data-cl-message></small></label>
  </fieldset>
  <button [disabled]="f.submitting || !f.dirty">Save</button>
  <button type="button" [disabled]="!f.dirty" (click)="f.reset()">Undo changes</button>
</form>
```

Try it: change the name and save, then make the server fail and save again. A name over 40 characters gets the server's error on the field.

<recipeProfile />

Tick *Make the server fail*, then like: the count goes up, and back down when the answer comes. With a cache key, [`setData()`](/reference/fetch#setdata) changes every resource showing that key at once.

## Requests in a chain, and in parallel

A resource that reads another's `value` waits for it, and runs again when it changes: a chain. `Promise.all` inside one fetcher asks several things at once. This one reads [JSONPlaceholder](https://jsonplaceholder.typicode.com), a free API, from the browser.

```tscl
<script>
  import { json, resource } from 'clarusjs/fetch'
  const API = 'https://jsonplaceholder.typicode.com'
  let id = state(1)
  const user = resource(({ signal }) => json(API + '/users/' + id, { signal }))
  const work = resource(({ signal }) =>
    user.value && Promise.all([
      json(API + '/posts?userId=' + user.value.id, { signal }),
      json(API + '/todos?userId=' + user.value.id, { signal }),
    ]),
  )
</script>
```

<recipeChain />

## A token that expires

Wrap `request()` once for the site, to add the token to every request. On a `401`, get a new token and try once more. Every resource and action then calls the wrapper.

```ts
// api.ts
import { request, type RequestOptions } from 'clarusjs/fetch'

let token = ''
async function refresh() {
  token = (await request('/api/auth', { method: 'POST' })).token
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!token) await refresh()
  const call = () => {
    const headers = new Headers(options.headers) // an object, pairs or Headers: all kept
    headers.set('authorization', 'Bearer ' + token)
    return request<T>(path, { ...options, headers })
  }
  try {
    return await call()
  } catch (e) {
    if ((e as { status?: number }).status !== 401) throw e
    await refresh() // expired: a new token, then once more
    return call()
  }
}
```

<recipeToken />

The demo's tokens last 3 seconds: ask, wait a few seconds, and ask again. *Tokens fetched* goes up by one, and the answer still comes. With axios, an interceptor does the same: see [With axios, ky or your own client](/guide/fetching#with-axios-ky-or-your-own-client).

## Retry, with backoff

`retry` tries again after a failure, waiting longer each time. The demo server fails the first request on purpose.

```ts
const visits = resource(({ signal }) => json('/api/stats?keys=visits', { signal }), {
  retry: { count: 3, delay: (attempt) => 300 * 2 ** (attempt - 1) }, // 300 ms, 600 ms, 1.2 s
})
```

<recipeRetry />

`onError` runs once, after the last attempt, and `error` holds the last failure. A cancelled run isn't retried.

## Prefetch on hover

Pointing at a link is a good guess that it's next. `prefetch()` fetches it into the cache, so the click shows it without waiting.

```tscl
<script>
  import { json, prefetch, resource } from 'clarusjs/fetch'
  let page = state(1)
  const url = (p) => '/api/records?page=' + p
  const list = resource(({ signal }) => json(url(page), { signal }), { key: () => ['pages', page] })
  function warm(p) {
    prefetch(['pages', p], ({ signal }) => json(url(p), { signal }))
  }
</script>

@for (p of [1, 2, 3]; track p) {
  <button (mouseenter)="warm(p)" (focus)="warm(p)" (click)="page = p">Page {{ p }}</button>
}
```

<recipePrefetch />

## Uploading a file

`FormData` goes as `fetch` sends it, with its own content type. An action gives the upload its pending state, and `abort()` cancels it.

```tscl
<script>
  import { action, request } from 'clarusjs/fetch'
  let file = new Blob()
  let chosen = state('')
  function pick(f) {
    file = f ?? new Blob()
    chosen = f ? f.name : ''
  }
  const send = action((_, { signal }) => {
    const body = new FormData()
    body.append('file', file)
    return request('/api/upload', { method: 'POST', body, signal })
  })
</script>

<input type="file" (change)="pick($event.target.files[0])" />
<button [disabled]="!chosen || send.pending" (click)="send.run()">Upload</button>
<button [disabled]="!send.pending" (click)="send.abort()">Cancel</button>
```

<recipeUpload />

`fetch` doesn't report upload progress. For a progress bar on large files, use `XMLHttpRequest`'s `upload.onprogress` inside the action's function: `action()` takes any function that returns a promise.

## Server data first, then fresh in the browser

Render the data on the server, so the page shows it before any JavaScript runs, then let the island bring it up to date. Load it in a [`<script server>`](/guide/fetching#on-the-server) (or the page's `load()`) and pass it to the island as `initial`:

```tscl
{{-- src/pages/dashboard.tscl --}}
<script server>
  import { json } from 'clarusjs/fetch'
  const stats = await json('https://api.example.com/stats')
</script>
<statsPanel [stats]="stats" />

{{-- src/components/stats-panel.tscl --}}
@input stats: { visits: number }
<script>
  import { json, resource } from 'clarusjs/fetch'
  const live = resource(({ signal }) => json('https://api.example.com/stats', { signal }), { initial: stats, refetch: { interval: 30_000 } })
</script>
<p>{{ live.value.visits }} visits</p>
```

The server HTML has the numbers; the browser fetches again quietly (no loading state) and every 30 seconds after.

<recipeServerFirst />

Here the number is in the page as built; once the island attaches, it asks the demo API again and says so.

## External APIs

- **An API that allows the browser** (it sends CORS headers, and needs no secret), like JSONPlaceholder above: fetch it straight from the island.
- **An API that doesn't**, or one that needs a key you can't put in the browser: call it from a server route, and fetch that route from the island. The key stays on the server, and the route can cache or trim the answer.

```ts
// src/pages/api/weather.ts: a server route the island fetches as /api/weather?city=Nairobi
import type { RequestHandler } from 'clarusjs/server'

export const GET: RequestHandler = async ({ request }) => {
  const city = new URL(request.url).searchParams.get('city') ?? 'Nairobi'
  const res = await fetch('https://api.weather.example/v1/now?city=' + encodeURIComponent(city), {
    headers: { authorization: 'Bearer ' + process.env.WEATHER_KEY },
  })
  if (!res.ok) return Response.json({ error: 'The weather service is down.' }, { status: 502 })
  const { temp, summary } = await res.json()
  return Response.json({ temp, summary }, { headers: { 'cache-control': 'public, max-age=300' } })
}
```

<recipeProxy />

The demo's route calls a stand-in API on this site that refuses requests without the key, and answers with more than the page shows (an account id). The island only ever sees `temp` and `summary`.

- **Rate limits.** Public APIs answer `429` (or GitHub's `403` with `x-ratelimit-remaining: 0`) when asked too often. Read them as errors and say when to try again:

```ts
const repo = resource(async ({ signal }) => {
  const res = await fetch('https://api.github.com/repos/forinda/clarusjs', { signal })
  if (res.status === 403 || res.status === 429) {
    const reset = Number(res.headers.get('x-ratelimit-reset')) * 1000
    throw new Error('Rate limited until ' + new Date(reset).toLocaleTimeString())
  }
  if (!res.ok) throw new Error('GitHub answered ' + res.status)
  return res.json()
})
```

<recipeRateLimit />

This one uses `fetch` itself because it needs the answer's headers on a failure. `request()` throws on a non-2xx answer with `status` and the body (`data`), which is enough everywhere else.
