---
'@clarusjs/ui': minor
---

`@clarusjs/ui` (#467), a new package: one stylesheet (`@import '@clarusjs/ui/ui.css'`) for `@clarusjs/ui-primitives`' parts, over their `data-part` names and state attributes. Design tokens (`--ui-accent`, `--ui-radius`, `--ui-font`…) with dark values by `prefers-color-scheme` or `data-theme`; every selector in `:where()`, so your CSS always wins; a visible focus ring, invalid fields marked by border, and no transitions with reduced motion. CSS only.
