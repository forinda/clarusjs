---
title: "Popover"
group: "Components"
order: 2
description: "Content that pops up by its trigger: the popover attribute (light dismiss, the top layer) placed with CSS anchor positioning. No JavaScript."
---

# Popover

<p class="lead">Content that pops up by its trigger: the popover attribute (light dismiss, the top layer) placed with CSS anchor positioning. No JavaScript.</p>

**Styled:** [Popover on ui.clarusjs.com](https://ui.clarusjs.com/components/popover), ready to copy, in plain CSS or Tailwind.

<uiGallery part="popover" />

```tscl
@import uiPopover from '@clarusjs/ui-primitives/popover.tscl'
@import uiPopoverTrigger from '@clarusjs/ui-primitives/popover-trigger.tscl'

<uiPopoverTrigger target="share">Share</uiPopoverTrigger>
<uiPopover id="share" side="bottom" align="start">…</uiPopover>
```

- **`side`** (`top`, `bottom`, `left`, `right`) and **`align`** (`start`, `center`, `end`): where it goes; it flips when there's no room.
- **Styling:** `:popover-open`; `data-side` and `data-align`.

From [`@clarusjs/ui-primitives`](/guide/ui-primitives#parts), styled by `@clarusjs/ui`: `@import '@clarusjs/ui/ui.css'` once, and change the look with its `--ui-` tokens (`--ui-accent`, `--ui-radius`, `--ui-font`…). Without it, the part is unstyled and works the same.
