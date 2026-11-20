---
"@clarusjs/content": minor
---

Snippets and includes: `<<< @/src/x.ts#region{2} [title]` shows a file (or a `#region` of it, dedented) as a highlighted block, and `<!-- @include: ./part.md#region -->` includes Markdown, nested, with relative links rebased to the including page. `@` is the project root; both are left alone inside code fences. Files are watched in dev. Missing files or regions, include cycles and paths outside the project fail the build, naming the page.
