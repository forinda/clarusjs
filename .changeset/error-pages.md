---
'clarusjs': patch
---

Error pages. When a page rendered on request fails (its `load()` throws or it can't render), the answer is the site's `src/pages/500.tscl` with status 500 (it gets a `status` input), or plain text without one; the error only goes to the server log. Builds also write `500.html` (left out of the sitemap). In development, the dev server shows the error itself with its stack instead.
