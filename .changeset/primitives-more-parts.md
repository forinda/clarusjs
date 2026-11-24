---
"@clarusjs/ui-primitives": minor
---

New parts: `toggle.tscl` (a button with `aria-pressed`, bound with `[(pressed)]`) and `toggle-group.tscl` with `toggle-item.tscl` (`type="single"` with `[(value)]` keeps one pressed, `type="multiple"` with `[(values)]`; one Tab stop and arrow keys through `rovingFocus`; the server writes each item's `aria-pressed`).
