---
'clarusjs': minor
---

`clarusjs/fetch`: `action()`, for one-off async calls such as save, delete or like (#429). It has `pending`, `error` and `result` for the template. `run(input)` never rejects (a failure lands in `error` and the callbacks); `runAsync(input)` does. A call while one runs joins it (no double submit), or with `concurrency: 'latest'` cancels it. It takes `abort()`, `timeout`, `onSuccess` / `onError` / `onSettled` (with the input), and `meta` for `configure()`'s handlers. Created in an island, a call in flight is cancelled when the island goes away.

A resource's or action's `timeout` is reported as a `TimeoutError` even when the client rejects with its own error on abort (axios: `CanceledError`). The Fetching guide shows axios, ky or your own client with `resource()` and `action()`.
