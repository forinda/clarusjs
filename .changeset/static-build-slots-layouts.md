---
"clarusjs": minor
---

Static sites: `vite build` now builds the client and server and prerenders every page to `dist/client/<route>/index.html`, and `vite preview` serves those pages at their routes. Stateless components can wrap content with a default `<slot />`, and a page whose layout renders `<html>` becomes the whole document (doctype added, island style and loader injected where they belong).
