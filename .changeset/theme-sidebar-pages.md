---
"@clarusjs/theme-docs": minor
---

The sidebar from the pages: the `themeDocs()` Vite plugin (`@clarusjs/theme-docs/vite.js`) reads `src/pages` and serves each page's title, frontmatter `group` and `order` as `virtual:theme-docs/pages`; `pagesNav(sections, pages)` fills each section from its folder, with the config's own groups and items kept first.
