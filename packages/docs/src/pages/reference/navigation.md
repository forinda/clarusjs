---
title: "clarusjs/navigation"
group: "APIs"
order: 5
description: "currentUrl, searchParams, navigate, setSearch, navigationState, the navigation hooks, navigating, view transitions and href: the exact contract of each, with usage."
---

# clarusjs/navigation

<p class="lead">Moving between pages from code, and hooking into it. For the how-to, see <a href="/guide/navigation">Navigation</a>, <a href="/guide/fragment-navigation">Fragment navigation</a> and <a href="/guide/client-routes">Client routes</a>.</p>

```ts
import { currentUrl, searchParams, navigate, setSearch, beforeNavigate, navigating, href } from 'clarusjs/navigation'
```

The hooks (`beforeNavigate`, `afterNavigate`, `onNavigateError`, `beforeSwap`, `afterSwap`) belong to the island that registers them: they stop when it leaves the page.

## currentUrl

```ts
const currentUrl: Signal<URL | null>
```

The current page's URL, as a store. It follows links, back and forward, and the page's own `pushState`/`replaceState`.

### Caveats

- **It's `null` on the server.** Pass the page's path as a prop when the server HTML needs it.

### Usage

```tscl
<script>
  import { currentUrl } from 'clarusjs/navigation'
  let here = shared(currentUrl)
</script>
<a href="/guide" [class]="here?.pathname === '/guide' ? 'active' : ''">Guide</a>
```

## navigate()

```ts
navigate(to: string | URL, options?: { replace?: boolean; state?: unknown; scroll?: boolean }): Promise<void>
```

Goes to `to`, as a link click would: the page's navigator swaps or renders the new page.

### Parameters

- **`to`**: the address. A root-relative path (`/account`) gets the site's [base](/guide/deploy#a-site-under-a-path), unless it's already under it (as `href()`'s are).
- **`options.replace`**: replace the current history entry instead of adding one.
- **`options.state`**: history state for the new entry, read back with `navigationState()`.
- **`options.scroll`**: `false` keeps the scroll position; by default the new page starts at the top (or at its `#hash`), and Back and Forward restore where the visitor was.

### Returns

A promise that resolves once the new page is shown. It also resolves when the navigation is cancelled, or a newer one replaces it: check `currentUrl` when that matters. It rejects when the navigation fails.

### Caveats

- **Without the browser's Navigation API** it loads the page normally (`location.assign`, or `replace`).

### Usage

```ts
async function save() {
  await post(form)
  await navigate('/account', { replace: true })
}
```

## searchParams {since=0.17.0}

```ts
const searchParams: Signal<URLSearchParams | null>
```

The current page's query, as a store kept in step with `currentUrl`.

### Caveats

- **It's `null` on the server**, like `currentUrl`.
- **Read it, don't write it.** Change the query with `setSearch()`: writing the store doesn't move the page.

### Usage

```tscl
<script>
  import { searchParams } from 'clarusjs/navigation'
  let query = shared(searchParams)
</script>
<p>Results for {{ query?.get('q') ?? 'everything' }}</p>
```

## setSearch() {since=0.17.0}

```ts
setSearch(changes: Record<string, string | number | null | readonly (string | number)[]>, options?: { replace?: boolean; state?: unknown; scroll?: boolean }): Promise<void>
```

Changes the current URL's query and goes there, as `navigate()` does. The path, the hash and other params stay.

### Parameters

- **`changes`**: per key, a value sets it (in place, if it was there), an array repeats it (`?tag=a&tag=b`), `null` removes it.
- **`options.replace`**: `true` by default, so a search box or filter doesn't fill Back with every change; `false` adds an entry (pagination).
- **`options.state`**: history state for the entry.
- **`options.scroll`**: `false` by default (the visitor stays where they are); `true` goes to the top.

### Returns

The same promise as `navigate()`. On the server it resolves at once and does nothing.

### Usage

```ts
setSearch({ q: input.value, page: null }) // a new search starts at page 1
setSearch({ page: 3 }, { replace: false }) // worth a Back step
```

## navigationState() {since=0.17.0}

```ts
navigationState<T = unknown>(): T | undefined
```

What `navigate(url, { state })` (or `setSearch(…, { state })`) stored with the current history entry. The browser keeps it for Back and Forward; it isn't in the URL, so a shared link doesn't carry it.

### Caveats

- **`undefined` on the server**, and when the entry has none.
- **Keep it small and serializable**: the browser stores it with the history entry.

### Usage

```ts
await navigate('/results', { state: { from: 'search' } })
// on /results
const from = navigationState<{ from?: string }>()?.from
```

## abort()

```ts
abort(): void
```

Stops the navigation in progress, like the browser's stop button. Its requests are cancelled. Where the URL was held while loading, the page and the URL stay as they were. Hooks see it through `t.signal`.

### Caveats

- **Like the stop button,** it also stops the page's own loading, such as images still arriving.

## back()

```ts
back(): void
```

Back one entry, like the browser's back button.

```tscl
<button (click)="back()">Back</button>
```

## beforeNavigate()

```ts
beforeNavigate(fn: (to: URL, nav: { type: string; cancel(): void }) => void): void
```

Runs before any navigation: links, forms, back and forward, and `navigate()`. `nav.cancel()` stops it.

### Caveats

- **Back and forward** can only be cancelled where the browser allows it.

### Usage

```ts
beforeNavigate((to, nav) => {
  if (dirty && !confirm('Leave without saving?')) nav.cancel()
})
```

## afterNavigate()

```ts
afterNavigate(fn: (to: URL) => void): void
```

Runs after a navigation within the page has finished: the new page is in, and its islands are attached.

```ts
afterNavigate((to) => analytics.page(to.pathname))
```

## onNavigateError()

```ts
onNavigateError(fn: (to: URL, error: unknown) => void): void
```

Runs when a navigation fails: a fragment or a client page couldn't be loaded. The page then loads normally.

```ts
onNavigateError((to, error) => report(error, { url: to.href }))
```

## navigating

```ts
const navigating: Signal<Transition | null>
```

The navigation in progress, as a store. It's `null` when idle. Otherwise it's a `Transition`:

- **`from`** and **`to`**: where it comes from and where it goes;
- **`type`**: `push`, `replace`, `reload` or `traverse`;
- **`phase`**: `'loading'` while the next page is fetched, `'swapping'` while it replaces this one;
- **`signal`**: aborts when a newer navigation takes over.

For CSS alone, `<html data-cl-navigating>` carries the phase.

```tscl
<script>
  import { navigating } from 'clarusjs/navigation'
  let nav = shared(navigating)
</script>
@if (nav) { <div class="progress" role="status">Loading {{ nav.to.pathname }}…</div> }
```

## viewTransitions()

```ts
viewTransitions(): void
```

Page changes run as view transitions where the browser has them (`document.startViewTransition`), so CSS `::view-transition-*` rules animate them. Elsewhere they stay instant. Call it once, from any island's script. For an element inside a page (an `@if` branch entering and leaving), see [`@transition`](/guide/animations#transition) instead.

### Caveats

- **`beforeSwap` hooks run before the browser's snapshot,** and `afterSwap` hooks once the new page is in.

## beforeSwap()

```ts
beforeSwap(fn: (t: Transition) => unknown): void
```

Runs once the next page is loaded, before it replaces this one: to animate out, or save state. Return a promise to make the navigation wait. `t.signal` aborts when a newer navigation takes over. If the hook throws, the page loads normally.

```ts
beforeSwap(() => document.querySelector('main')?.animate({ opacity: [1, 0] }, 150).finished)
```

## afterSwap()

```ts
afterSwap(fn: (t: Transition) => unknown): void
```

Runs once the new page is in and its islands are attached: to animate in, or move focus. Return a promise to make the navigation wait.

```ts
afterSwap(() => document.querySelector('h1')?.focus())
```

## href()

```ts
href(route: RouteName, params?: Record<string, string>): string
```

A page's URL from its route, as its file names it, with the site's base: `href('/releases/[version]', { version: '0.8.0' })` is `'/releases/0.8.0'`. Params are encoded.

### Caveats

- **Typed once `clarusjs check` has run:** it writes `.clarusjs/routes.d.ts`. After that, a route that doesn't exist or a missing param is a type error (`Routes`, `RouteName`).

### Usage

```tscl
<a [href]="href('/releases/[version]', { version: '0.8.0' })">0.8.0</a>
```

## withBase() {since=0.18.0}

```ts
withBase(path: string): string
```

A root-relative path with the site's base (Vite's `base`): `withBase('/api/items')` is `/docs/api/items` at a site under `/docs/`. For URLs built in code, such as `fetch()` or a link a script makes. A template's URL attributes (`href`, `src`…) get the base by themselves. A path already under the base, a full URL, `//host`, `#…`, `?…` and a relative path are returned as they are.

```ts
const items = await (await fetch(withBase('/api/items'))).json()
```

## withoutBase() {since=0.18.0}

```ts
withoutBase(url: string): string
```

The reverse: `/docs/guide` is `/guide` at a site under `/docs/`. Use it to compare a link (which has the base) with a route (which doesn't): `withoutBase(link.getAttribute('href')) === '/guide'`.
