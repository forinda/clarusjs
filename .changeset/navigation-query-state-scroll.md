---
'clarusjs': minor
---

clarusjs/navigation: `searchParams` (the current query, as a store), `setSearch(changes, { replace, state, scroll })` (set, repeat or remove query params and go there; replaces the entry and keeps the scroll position by default), `navigationState()` (what `navigate(url, { state })` stored), and `scroll: false` on `navigate()` to keep the visitor where they are. The Navigation guide is rewritten by task: where am I, moving, query strings, scroll, history state, cancelling, loading states.
