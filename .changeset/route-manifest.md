---
"clarusjs": minor
---

`vite build` writes `dist/clarusjs-manifest.json`: for every route, its mode, its loader, the islands it renders (component, attach mode, count, gzip size) and the JavaScript and CSS it ships, with the gzip bytes that load with the page and in all. Read from the prerendered HTML and Vite's client manifest; kept outside `dist/client` so it isn't published.
