---
'@clarusjs/theme-docs': patch
---

The theme's Tailwind classes drop the `tw:` prefix (`flex`, `bg-surface`). Tailwind now reads only the `class="…"` attributes of the theme's templates (`scripts/classes.js`), so words in their text no longer become utilities, and a test keeps the theme's own class names from also being utilities. The built stylesheet holds only the utilities the theme uses.
