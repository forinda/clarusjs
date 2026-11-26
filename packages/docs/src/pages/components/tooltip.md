---
title: "Tooltip"
group: "Components"
order: 10
description: "A short hint on hover and focus: a hint popover anchored to its trigger, which it describes."
---

# Tooltip

<p class="lead">A short hint for a button, shown on hover and on focus. The tooltip is a hint popover placed next to its trigger by CSS anchor positioning, and it's the trigger's accessible description.</p>

**Styled:** [Tooltip on ui.clarusjs.com](https://ui.clarusjs.com/components/tooltip), ready to copy, in plain CSS or Tailwind.

<uiGallery part="tooltip" />

```tscl
@import uiTooltip from '@clarusjs/ui-primitives/tooltip.tscl'
@import uiTooltipTrigger from '@clarusjs/ui-primitives/tooltip-trigger.tscl'

<uiTooltipTrigger target="copy-tip">Copy link</uiTooltipTrigger>
<uiTooltip id="copy-tip" side="bottom">Copies the page's address</uiTooltip>
```

- **`side`**: `top` (the default), `bottom`, `left` or `right`; it flips when there's no room.
- **Shown** on hover (after a short delay) and on focus; it stays while the pointer is on it, and closes on Escape, blur or leaving. Browsers with interest invokers (`interestfor`) do this themselves; elsewhere the trigger, a small island, does.
- **Short text only.** Nothing in a tooltip can be clicked; use a [popover](/components/popover) for that.
- **Styling:** `data-part="tooltip"`, `:popover-open`, and `data-side`.

From [`@clarusjs/ui-primitives`](/guide/ui-primitives#parts), styled by `@clarusjs/ui`: `@import '@clarusjs/ui/ui.css'` once, and change the look with its `--ui-` tokens (`--ui-accent`, `--ui-radius`, `--ui-font`…). Without it, the part is unstyled and works the same.
