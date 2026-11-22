---
'@clarusjs/theme-docs': patch
---

The theme's stylesheet is now written with Tailwind and built to the plain `theme.css` the package ships: sites need no Tailwind, and the page looks the same (pixel-identical on the docs site). Its utilities are built on the tokens, so `--accent` and the others still restyle everything.
