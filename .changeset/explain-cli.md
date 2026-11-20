---
"clarusjs": minor
---

`clarusjs explain [route]`: where each part of a built route runs, in plain words (rendered at build time, its data, each island with its size and when it attaches, JavaScript on page load and in all, CSS), read from `dist/clarusjs-manifest.json`. Without a route it lists every route; `--json` prints the manifest entry.
