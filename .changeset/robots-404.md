---
"clarusjs": minor
---

`robots.txt` and a 404 page.

- With `site` set, `vite build` writes `robots.txt` that allows all crawlers and points at the sitemap. A `public/robots.txt` of your own wins, and `robots: false` turns it off.
- `src/pages/404.tscl` (or `404.md`) is served for unknown addresses with status 404 in dev, in server mode and in `vite preview`.
- `vite build` writes it to `404.html` for static hosts. Its relative links are resolved from the site root, so they work at any depth, and it is never in the sitemap.
