---
"clarusjs": minor
---

A static (or client) route's `load()` that reads `cookies` or the request's headers is now an error: "/account reads cookies, but static routes are built once for everyone: make it 'server'". Such a page used to be built once with whatever the build saw. `clarusjs explain` and `dist/clarusjs-manifest.json` (`cookies: true`) show which server routes read cookies.
