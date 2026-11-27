---
'clarusjs': minor
---

`clarusjs serve` (and `serve()` / `createListener()` from `clarusjs/node`) runs a built site on any Node host: files with ETags, immutable caching for hashed assets, server routes and endpoints through the built handler, the 404 page, and precompressed copies. New `headers` plugin option: response headers by path pattern, written to `_headers` (read by Netlify and Cloudflare Pages, applied by `clarusjs serve` and `vite preview`), after safe defaults (`nosniff`, `Referrer-Policy`, immutable assets). `headers: false` writes none.
