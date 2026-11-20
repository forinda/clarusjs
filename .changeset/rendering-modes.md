---
"clarusjs": minor
---

Per-route rendering modes: `clarusjs({ routes: { '/account/*': 'server' } })`. Static routes (the default) are prerendered; server routes are left out of prerendering (a dynamic one needs no `entries()`) and render per request from `dist/server/index.mjs`, with `load()` getting the visitor's request. The most specific pattern wins; an unknown mode or a malformed pattern is a config error. `vite preview` serves server routes through the built handler, and the route manifest and `clarusjs explain` show each route's mode.
