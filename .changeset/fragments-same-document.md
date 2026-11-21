---
"clarusjs": patch
---

Fragment navigation no longer turns a page's own `history.pushState` / `replaceState` into a page load (it refetched the fragment and moved focus). Back and forward still swap pages.
