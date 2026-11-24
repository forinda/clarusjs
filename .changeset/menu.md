---
"@clarusjs/ui-primitives": minor
"@clarusjs/ui": minor
---

Menu (#465): `menu.tscl` (a small island) with `menu-trigger.tscl`, `menu-list.tscl` and `menu-item.tscl` (no script). The list is a popover opened by its trigger, so opening, closing, Escape and a click outside come from the browser; the menu moves focus in on open, keeps `aria-expanded` in step, adds arrow keys, Home, End and typeahead, and sends `(select)` with the item's value (cancellable). `@clarusjs/ui` styles them.
