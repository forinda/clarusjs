---
"@clarusjs/ui-primitives": minor
---

New parts: `toggle.tscl` (a button with `aria-pressed`, bound with `[(pressed)]`) and `toggle-group.tscl` with `toggle-item.tscl` (`type="single"` with `[(value)]` keeps one pressed, `type="multiple"` with `[(values)]`; one Tab stop and arrow keys through `rovingFocus`; the server writes each item's `aria-pressed`). `toast(message, { action?, duration? })` and `toast-region.tscl`: put the region once in your layout; any island's `toast()` shows there (the list lives on `globalThis`, shared however the bundle is split). A polite live region that never takes focus; each message stays its duration (paused while hovered or focused); Escape dismisses the focused one; an action runs and dismisses.
