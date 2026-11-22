---
"clarusjs": patch
---

`vite build --watch` works: after each change under `src/` or `public/`, the client build, the server build and the prerender run again in order, so pages point at the rebuilt islands' new hashes (it used to fail looking for the server build). In dev, island URLs use forward slashes on Windows, and `/@fs/` URLs for components outside the root carry the drive (`/@fs/C:/libs/c.tscl`).
