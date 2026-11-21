---
title: "Navigation"
group: "Interactivity"
order: 8
description: "Move between pages from islands with navigate(), read the current URL, and hook into navigations: cancel one, react after it, handle errors."
---
@import leaveGuard from '../../components/leave-guard.tscl'
@import swapDemo from '../../components/swap-demo.tscl'

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

`navigate()` resolves once the new page is shown. Without the Navigation API it is a normal page load. Island scripts also run on the server, where `currentUrl` is `null` and navigating does nothing.

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
import { navigating, beforeSwap, afterSwap } from 'clarusjs/navigation'

let nav = shared(navigating)                 // null when idle, else { from, to, type, phase, signal }
beforeSwap((t) => fadeOut(t.signal))         // the next page is loaded; this one is still shown
afterSwap(() => document.querySelector('h1')?.focus())  // the new page is in, its islands attached
```

In-between hooks run in order and may return a promise: the page change waits for it. `t.signal` aborts when a newer navigation takes over. A hook that throws makes the page load normally.

<swapDemo />
