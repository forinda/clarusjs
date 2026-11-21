---
'clarusjs': minor
---

`clarusjs/fetch`: data an island fetches itself, in the browser (#258).

- `resource(fetcher, options)` gives `value`, `loading`, `error`, `refetch()` and `mutate()`. It re-runs when a signal the fetcher reads changes, so requests chain. The latest run wins, and a disposed island aborts its run.
- Options: retry with backoff; refetch on an interval or when the tab regains focus; a starting value from `load()`, revalidated in the browser unless `refetch: { onStart: false }`.
- `batch(load)` sends the keys asked of one endpoint at the same moment, from any island, as one request.
- `json(url)` throws on a non-2xx response.

Nothing is fetched on the server. The entry stays within 1.5 KB gzip, and a page that doesn't import it ships none of it. See https://clarusjs.com/guide/fetching.
