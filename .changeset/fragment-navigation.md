---
"clarusjs": minor
---

Fragment navigation: with `fragments: true`, every static and server page loads a navigation script (under 1 KB gzip) that intercepts same-site navigations with the Navigation API, fetches the page's `index.frag.html`, swaps its region (`data-cl-swap`, or the body), updates the title, and attaches the islands that arrive. Elements marked `data-cl-persist="key"` are kept across swaps with their state. Back and forward work; only the latest navigation may change the page; a failure falls back to a normal load. Browsers without the Navigation API load pages normally.
