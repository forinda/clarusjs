---
'clarusjs': minor
---

Other Vite plugins can name components for clarusjs to build: `api: { clarusComponents: (root) => [...files] }`. They are found like the components under `src/`, so their styles reach the stylesheet and their islands get client chunks, though no page imports them by path (a docs theme's replacement for one of its parts, for example).
