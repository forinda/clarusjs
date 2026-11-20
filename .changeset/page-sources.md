---
"clarusjs": minor
---

Page sources: `clarusjs({ sources: [...] })` lets a plugin turn files with another extension (such as `.md` from `@clarusjs/content`) into `.tscl` text, compiled like any page: routes, layouts, components, styles, islands and the manifest all apply. Only files under `src/` are claimed, never `?raw`/`?url` imports.
