---
"clarusjs": patch
---

`vite build` no longer publishes Vite's manifest (`dist/client/.vite/manifest.json`) with the site. `vite preview` answers a malformed URL with 400 instead of passing it on, and its built-page lookup compares against the output folder with a separator, so a path into a sibling folder (`dist/clientx`) can't be mistaken for a page of the site.
