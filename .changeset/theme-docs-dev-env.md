---
'@clarusjs/theme-docs': patch
---

Pages using the theme render again in `vite dev`. The search module read `import.meta.env` in a form Vite 8's dev module runner refuses, so every page answered 500 in development (builds were fine).
