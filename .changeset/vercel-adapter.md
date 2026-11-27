---
'clarusjs': minor
---

`adapter: 'vercel'`: `vite build` writes Vercel's Build Output API (`.vercel/output`): static files with clean URLs, one bundled Node function running the same handler for server routes and endpoints, and routes for `_headers`, `_redirects` and the 404 page.
