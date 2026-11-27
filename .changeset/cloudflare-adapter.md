---
'clarusjs': minor
---

`adapter: 'cloudflare'`: `vite build` writes a bundled worker (`dist/client/_worker.js/`) running the same handler for server routes and endpoints, `_routes.json` so static files are served first, and `.assetsignore` so the folder also deploys as a Worker with static assets. The worker applies `_headers` to its responses. `clarusjs serve` never serves these files.
