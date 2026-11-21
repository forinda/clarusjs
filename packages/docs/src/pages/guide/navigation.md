---
title: "Navigation"
group: "Interactivity"
order: 8
description: "Move between pages from islands with navigate(), read the current URL, and hook into navigations: cancel one, react after it, handle errors."
---
@import leaveGuard from '../../components/leave-guard.tscl'

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
