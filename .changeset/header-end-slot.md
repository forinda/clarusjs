---
'@clarusjs/theme-docs': minor
---

The layout has a `header-end` slot: a site's own button or menu in the header, before the theme toggle, kept across navigations. A replaced header part (`themeDocs({ components: { header } })`) needs `<slot name="end"></slot>` where it should go; the build says so if it's missing.
