---
'clarusjs': minor
---

`clarusjs/fetch` caches answers by key (#287), for paginated lists and other data shown again and again:

- `resource(fetcher, { key: () => ['items', { page }] })` shares one cache entry per key across the page's islands. A key seen before is served without a request until it's invalidated, or `stale` ms old. The previous value stays on screen while a new key loads. Requests for the same key at the same time share one request.
- `invalidate(['items'])`: every cached answer whose key starts with that prefix is marked stale. The ones on screen refetch now; the others refetch when next used.
- `setData(key, value | fn)` for optimistic edits, and `prefetch(key, fetcher)` for the next page.
- An answer nothing shows is dropped after `keep` ms (default 5 minutes).
