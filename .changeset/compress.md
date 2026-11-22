---
"clarusjs": minor
---

`clarusjs({ compress: true })`: `vite build` writes `.br` and `.gz` next to each HTML, JS, CSS, SVG, JSON and XML file in `dist/client` (Node's `zlib`, no dependency), each kept only when smaller, for servers that serve precompressed files directly (nginx `gzip_static`/`brotli_static`, Caddy `precompressed`).
