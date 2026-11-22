---
'@clarusjs/theme-docs': minor
---

The docs sidebar, redesigned: a search box at the top (it opens the search dialog; the header's button hides where the sidebar shows), each group with an `icon` and a chevron and collapsible (`collapsed: true`; the current page's group is always open, with no JavaScript), pages on a guide line with the current one marked by a bar, and badges (`badge: "New"` in a page's frontmatter or on an item). The theme's utilities are now unlayered, so they win over its base rules for elements as specificity says.
