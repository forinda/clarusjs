---
'@clarusjs/content': minor
---

Frontmatter `layout: false` renders a Markdown page with no layout at all, not even its folder and config layouts (it compiles as `@layout none`, #472). A page with no layout of its own still gets them, as a `.tscl` page does.
