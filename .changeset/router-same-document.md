---
'clarusjs': patch
---

The client router leaves the page's own `history.pushState` and `replaceState` alone: they no longer re-render the route (which lost focus and state and fetched `__data.json` again). Back and forward still render, and a `replaceState` while the next page loads still shows that page.
