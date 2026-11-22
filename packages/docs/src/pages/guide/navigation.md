---
title: "Navigation"
group: "Interactivity"
order: 8
description: "Move between pages from islands with navigate(), read the current URL, and hook into navigations: cancel one, react after it, handle errors."
---

# Navigation

<p class="lead">Islands move between pages with <code>clarusjs/navigation</code>. Navigations go through the page's navigator, <a href="/guide/fragment-navigation">fragments</a> or the <a href="/guide/client-routes">client router</a>, exactly like a link click.</p>

## Moving

```ts
import { navigate, back, currentUrl } from 'clarusjs/navigation'

await navigate('/guide/lists')                    // like clicking a link
await navigate('/search?q=x', { replace: true })  // replaces the current entry
back()                                             // like the back button
let here = shared(currentUrl)                     // the current URL, as a store
```

`navigate()` resolves once the new page is shown, and also when the navigation is cancelled (a `beforeNavigate` hook, `abort()`) or replaced by a newer one: resolving doesn't prove the page is shown, so check `currentUrl` when that matters. It rejects when the page fails to load. Without the Navigation API it is a normal page load. Island scripts also run on the server, where `currentUrl` is `null` and navigating does nothing.

## Typed routes

`href()` builds a page's URL from its route, as its file names it, with the site's base:

```ts
import { href } from 'clarusjs/navigation'

href('/guide/holes')                              // '/guide/holes'
href('/releases/[version]', { version: '0.8.0' }) // '/releases/0.8.0' (params are encoded)
navigate(href('/tour/[step]', { step: '2' }))
```

`clarusjs check` writes `.clarusjs/routes.d.ts`, every page's route and its params. With it, a route that doesn't exist or a missing param is a type error, at `file.tscl:line:col` in templates too. Add the file to your `tsconfig.json`'s `include` for the same errors in your editor. The client tour on this site builds its links this way. Plain `<a href="/typo">` links are checked by the build's link check instead.

## Hooks

Hooks registered in an island's script are released with the island.

```ts
import { beforeNavigate, afterNavigate, onNavigateError } from 'clarusjs/navigation'

beforeNavigate((to, nav) => { if (unsaved) nav.cancel() })
afterNavigate((to) => track(to.pathname))
onNavigateError((to, error) => report(error)) // the page then loads normally
```

Try it: type a note, then click a link in the sidebar.

<leaveGuard />

## Transitions

Every page change goes through the same steps: `loading` (the next page is fetched), then `swapping` (it replaces this one). While one runs, `<html>` carries `data-cl-navigating="loading"` or `"swapping"`, so CSS alone can show progress; this site's thin bar at the top is just that.

```ts
import { navigating, beforeSwap, afterSwap, abort } from 'clarusjs/navigation'

let nav = shared(navigating)                 // null when idle, else { from, to, type, phase, signal }
beforeSwap((t) => fadeOut(t.signal))         // the next page is loaded; this one is still shown
afterSwap(() => document.querySelector('h1')?.focus())  // the new page is in, its islands attached
```

`abort()` stops the navigation in progress, like the browser's stop button: its requests are cancelled. While a link or `navigate()` loads, the address bar keeps the current URL (in browsers that support it; elsewhere it changes at once), so stopping leaves page and URL as they were.

In-between hooks run in order and may return a promise: the page change waits for it. `t.signal` aborts when a newer navigation takes over. A hook that throws makes the page load normally.

<swapDemo />

### View transitions

```ts
import { viewTransitions } from 'clarusjs/navigation'
viewTransitions() // once, from any island
```

Page changes then run as [view transitions](https://developer.mozilla.org/docs/Web/API/View_Transition_API) where the browser has them: a cross-fade by default, changed with `::view-transition-*` rules in your CSS. Elsewhere they stay instant. `beforeSwap` hooks run before the browser's snapshot of the old page, `afterSwap` hooks once the new one is in. The docs theme turns it on with `viewTransitions: true` in its config, as this site does.
