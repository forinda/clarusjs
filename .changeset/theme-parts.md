---
'@clarusjs/theme-docs': minor
---

The docs layout is made of public parts, each usable on its own: `parts/header.tscl`, `parts/sidebar.tscl` (slots `top`, `bottom`), `parts/contents.tscl` ("On this page", `inline` for the box form), `parts/page-footer.tscl` and `parts/footer.tscl`. The HTML a site gets is unchanged, apart from the scope class each part's top-level element carries; search indexing matches the parts by class token.
