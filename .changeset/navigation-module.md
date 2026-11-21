---
'clarusjs': patch
---

New entry `clarusjs/navigation` for islands: `navigate(to, { replace, state })` and `back()` move between pages through the page's navigator (fragments or the client router, as a link click would), and `currentUrl` is the current URL as a store (`let here = shared(currentUrl)`; `null` on the server). Without the Navigation API, `navigate()` is a normal page load. Ships only with islands that import it.
