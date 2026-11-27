---
title: "Navigation"
group: "Interactivity"
order: 8
description: "From islands: read where you are (path, query, params), move, keep a search or filter in the URL, pass history state, cancel, and show loading states."
---

# Navigation

<p class="lead">Islands move between pages with <code>clarusjs/navigation</code>. Navigations go through the page's navigator, <a href="/guide/fragment-navigation">fragments</a> or the <a href="/guide/client-routes">client router</a>, exactly like a link click.</p>

## Where am I

Three things describe the current page, and each has a store an island reads with `shared()`:

```tscl
<script>
  import { currentUrl, searchParams } from 'clarusjs/navigation'
  let here = shared(currentUrl)      // URL: here?.pathname, here?.hash
  let query = shared(searchParams)   // URLSearchParams: query?.get('q'), query?.getAll('tag')
</script>
<a href="/guide" [aria-current]="here?.pathname === '/guide' ? 'page' : null">Guide</a>
<p>Results for {{ query?.get('q') ?? 'everything' }}</p>
```

- **Both follow every move**: links, Back and Forward, `navigate()`, `setSearch()`, and the page's own `pushState`.
- **Both are `null` on the server**, which renders the page before any visitor's URL exists for a prerendered page. Write templates so `null` renders a sensible default (as above), or pass what the server knows as a prop.
- **Route params** (`/blog/[slug]`) belong to the page: its `load()` gets `params` and returns them as inputs (see [Routing](/guide/routing#loading-data)). Pass the ones an island needs as props: `<likeButton [slug]="slug" />`.

## Moving

```ts
import { navigate, back } from 'clarusjs/navigation'

await navigate('/guide/lists')                    // like clicking a link
await navigate('/search?q=x', { replace: true })  // replaces the current entry
back()                                             // like the back button
```

`navigate()` resolves once the new page is shown, and also when the navigation is cancelled (a `beforeNavigate` hook, `abort()`) or replaced by a newer one: resolving doesn't prove the page is shown, so check `currentUrl` when that matters. It rejects when the page fails to load. Without the Navigation API it is a normal page load. Island scripts also run on the server, where navigating does nothing.

### Typed routes

`href()` builds a page's URL from its route, as its file names it, with the site's base:

```ts
import { href } from 'clarusjs/navigation'

href('/guide/holes')                              // '/guide/holes'
href('/releases/[version]', { version: '0.8.0' }) // '/releases/0.8.0' (params are encoded)
navigate(href('/tour/[step]', { step: '2' }))
```

`clarusjs check` writes `.clarusjs/routes.d.ts`, every page's route and its params. With it, a route that doesn't exist or a missing param is a type error, at `file.tscl:line:col` in templates too. Add the file to your `tsconfig.json`'s `include` for the same errors in your editor. The client tour on this site builds its links this way. Plain `<a href="/typo">` links are checked by the build's link check instead.

## Query strings {since=0.17.0}

Keep a search, a filter or a page number in the URL, so a reload or a shared link shows the same thing. Read it with `searchParams`; change it with `setSearch()`:

```ts
import { setSearch } from 'clarusjs/navigation'

setSearch({ q: 'forms' })                  // ?q=forms, the rest of the query kept
setSearch({ q: 'forms', page: null })      // a new search starts at page 1: null removes a key
setSearch({ tag: ['a', 'b'] })             // ?tag=a&tag=b
setSearch({ page: 3 }, { replace: false }) // a page is worth a Back step
```

- **It replaces the history entry by default**, so Back leaves the page instead of undoing each search. Pass `{ replace: false }` for steps a visitor would want to go back through.
- **A key keeps its place** when you change its value; the path and the `#hash` stay.
- **The scroll position stays** too (see [Scroll](#scroll)).
- **It moves the page like a link**: with [fragments](/guide/fragment-navigation) the page is fetched again, so run it on submit or change, not on every keystroke.

Try it: search, filter, then reload or copy the address.

<queryDemo />

## Scroll {since=0.17.0}

The browser handles scrolling for every page change, as it does for full page loads:

- **Back and Forward** put the visitor where they were on that page.
- **A new page** (a link, `navigate()`) starts at the top; a link with a `#hash` scrolls to its target.
- **`setSearch()` stays where the visitor is**: a filter or a search shouldn't jump to the top. `{ scroll: true }` goes to the top instead.

To stay put on any other change, pass `scroll: false`:

```ts
navigate('/inbox?selected=42', { scroll: false })  // the list stays where it was
```

Without the Navigation API, page loads are the browser's own, and it does the same.

## History state {since=0.17.0}

Something to keep with a history entry, but not in the URL (where it came from, a scroll position): pass `state`, and read it back with `navigationState()`. The browser keeps it for Back and Forward; a shared link doesn't carry it.

```ts
import { navigate, navigationState } from 'clarusjs/navigation'

await navigate('/results', { state: { from: 'search' } })
// on /results, now or after Back and Forward:
const from = navigationState<{ from?: string }>()?.from
```

Keep it small and serializable. Without the Navigation API it is `history.state`.

## Cancelling

Three ways a navigation stops, each for a different job:

- **Before it starts**: `beforeNavigate` sees every navigation (a link, `navigate()`, Back) and may `cancel()` it, to keep unsaved work. Try the note below, then click a link in the sidebar.

```ts
import { beforeNavigate } from 'clarusjs/navigation'
beforeNavigate((to, nav) => { if (unsaved) nav.cancel() })
```

<leaveGuard />

- **While it loads**: `abort()` stops the navigation in progress, like the browser's stop button. Its requests are cancelled, and page and URL stay as they were.
- **Your own work, when the page moves on**: each transition carries `signal`, which aborts when a newer navigation takes over. Hand it to anything you start for it, so stale work stops:

```ts
import { beforeSwap } from 'clarusjs/navigation'
beforeSwap(async (t) => {
  const res = await fetch(`/api/preview?path=${t.to.pathname}`, { signal: t.signal }) // dropped if the visitor clicks again
  cache.set(t.to.pathname, await res.json())
})
```

For an island's own requests while it stays on the page, see [Fetching](/guide/fetching): `resource()` cancels the previous request on its own.

## Loading states

Every page change goes through `loading` (the next page is fetched), then `swapping` (it replaces this one). Show it two ways:

- **In CSS alone**: while one runs, `<html>` carries `data-cl-navigating="loading"` or `"swapping"`. This site's thin bar at the top is only that:

```css
html[data-cl-navigating] .progress { opacity: 1 }
```

- **In an island**: `navigating` is the transition in progress, or `null`. It knows where it's going, so a link can show its own spinner:

```tscl
<script>
  import { navigating } from 'clarusjs/navigation'
  let nav = shared(navigating)   // null, or { from, to, type, phase, signal }
</script>
<a href="/reports" [aria-busy]="nav?.to.pathname === '/reports' ? 'true' : null">Reports</a>
```

## Hooks

Hooks registered in an island's script are released with the island.

```ts
import { beforeNavigate, afterNavigate, onNavigateError } from 'clarusjs/navigation'

beforeNavigate((to, nav) => { if (unsaved) nav.cancel() })
afterNavigate((to) => track(to.pathname))
onNavigateError((to, error) => report(error)) // the page then loads normally
```

## Transitions

Between `loading` and `swapping`, hooks can run code around the swap: animate out, then focus something on the new page.

```ts
import { beforeSwap, afterSwap } from 'clarusjs/navigation'

beforeSwap((t) => fadeOut(t.signal))                    // the next page is loaded; this one is still shown
afterSwap(() => document.querySelector('h1')?.focus())  // the new page is in, its islands attached
```

They run in order and may return a promise: the page change waits for it. `t.signal` aborts when a newer navigation takes over. A hook that throws makes the page load normally. While a link or `navigate()` loads, the address bar keeps the current URL (in browsers that support it; elsewhere it changes at once).

<swapDemo />

### View transitions

```ts
import { viewTransitions } from 'clarusjs/navigation'
viewTransitions() // once, from any island
```

Page changes then run as [view transitions](https://developer.mozilla.org/docs/Web/API/View_Transition_API) where the browser has them (the whole page, old to new: not [`@transition`](/guide/animations#transition), which animates an `@if` inside an island): a cross-fade by default, changed with `::view-transition-*` rules in your CSS. Elsewhere they stay instant. `beforeSwap` hooks run before the browser's snapshot of the old page, `afterSwap` hooks once the new one is in. The docs theme turns it on with `viewTransitions: true` in its config, as this site does.
