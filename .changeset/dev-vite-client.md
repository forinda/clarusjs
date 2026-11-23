---
'clarusjs': patch
---

In `vite dev`, every page loads Vite's client, islands or not. A page without islands loaded no JavaScript at all, so edits to its styles, its layout or a global stylesheet never reached the browser until a manual reload.
