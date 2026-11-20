---
"clarusjs": minor
---

Build-time link checking: once every page is built, links to pages and files that don't exist fail the build, and links to a missing `#anchor` warn, each with the source file and line and a "did you mean" suggestion. Configure with `links: { pages, anchors, strict }` (`error`, `warn` or `off`).
