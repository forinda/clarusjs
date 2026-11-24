---
"@clarusjs/ui-primitives": minor
"@clarusjs/ui": minor
---

Tabs (#465), Radix-shaped: `tabs.tscl` (a small island) with `tab-list.tscl`, `tab.tscl` and `tab-panel.tscl`, which read the selection from context and ship nothing, so the server writes every ARIA attribute and `hidden`. Arrow keys, Home and End select; `[(value)]` binds the selected value and `(change)` can be cancelled. `@clarusjs/ui` styles them.
