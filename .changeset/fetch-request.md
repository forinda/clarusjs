---
'clarusjs': minor
---

`clarusjs/fetch`: any response, cancelling, timeouts and error callbacks (#431).

- `request(url, options)` reads the body by its `Content-Type` (JSON for `application/json` and `+json`, text for `text/*` and XML, else a `Blob`; `undefined` for a 204), or as `as` says (`json`, `text`, `blob`, `arrayBuffer`, `formData`, `stream`, `response`); `parse` adds your own readers per content type. A plain object or array `body` is sent as JSON. A non-2xx response throws with `status` and `data` (the error body). `timeout` aborts with a `TimeoutError`. `as` sets the result's type (`text`: `string`, `response`: `Response`…). `json()` and the new `text()` are its shorthands; a `json()` error now has `data` too.
- `resource()`: `abort()` cancels the run in flight (not an error), `timeout` fails a slow run (an error), and `onSuccess` / `onError` / `onSettled` run once per request, with `meta`.
- `configure({ onSuccess, onError })`: handlers every resource calls after its own callbacks, for toasts in one place; a callback returning `false` skips them.
