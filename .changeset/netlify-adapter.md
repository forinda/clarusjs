---
"clarusjs": minor
---

`adapter: 'netlify'`: `vite build` writes a Netlify Function (`.netlify/v1/functions/clarusjs-server.mjs`, Frameworks API) that runs the same `fetch` handler for server routes only, with their paths in URLPattern syntax and static files served first. No server routes, no function. An unknown adapter is a config error.
