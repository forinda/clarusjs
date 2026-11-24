---
"@clarusjs/ui-primitives": minor
"@clarusjs/ui": minor
---

Tooltip (#465): `tooltip.tscl` (a hint popover, `popover="hint"`, anchored to its trigger) and `tooltip-trigger.tscl` (a button described by it). Browsers with interest invokers (`interestfor`) show and hide it themselves; elsewhere the trigger, a small island, does: on hover after a short delay, on focus, kept open while the pointer is on it, closed on Escape, blur or leaving. `@clarusjs/ui` styles it.
