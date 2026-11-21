---
'@clarusjs/content': patch
---

Frontmatter schemas: `markdown({ schema })` validates each page's frontmatter with any Standard Schema (Zod, Valibot, ArkType…), one for every page or one per folder glob under `src/pages`. A page that doesn't match fails the build with `file: frontmatter.key: message`; the schema's output (defaults, coercions) is what the page gets. No schema library dependency.
