---
'clarusjs': minor
---

Folder guards (#457). A `+guard.ts` in a folder of `src/pages` exports `guard(context)`, which runs before every page and endpoint under it (and before their `load()`), outer folders first. Returning a `Response` (such as `redirect()`) answers instead; returning nothing goes on, and it may set `locals`. It gets `load()`'s context plus `url` (typed `GuardContext` from `clarusjs/server`), with the same rules: on a static route it runs at build and can't read cookies; for a client route it runs when the route's data is asked for. `+guard.ts` is never an endpoint.
