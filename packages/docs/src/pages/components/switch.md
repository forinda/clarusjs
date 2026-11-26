---
title: "Switch and checkbox"
group: "Components"
order: 4
description: "On or off: a native checkbox in its label (role='switch' for the switch), bound two ways."
---

# Switch and checkbox

<p class="lead">On or off: a native checkbox in its label (role="switch" for the switch), bound two ways.</p>

**Styled:** [Switch and checkbox on ui.clarusjs.com](https://ui.clarusjs.com/components/switch), ready to copy, in plain CSS or Tailwind.

<uiGallery part="switch" />

```tscl
@import uiSwitch from '@clarusjs/ui-primitives/switch.tscl'
@import uiCheckbox from '@clarusjs/ui-primitives/checkbox.tscl'

<uiSwitch label="Notifications" [(checked)]="settings.notify" />
<uiCheckbox label="I agree to the terms" [(checked)]="agreed" />
```

- **`name`** submits it with its form; **`disabled`**.
- **Styling:** `:checked`, and `data-checked` / `data-disabled` on the label.

From [`@clarusjs/ui-primitives`](/guide/ui-primitives#parts), styled by `@clarusjs/ui`: `@import '@clarusjs/ui/ui.css'` once, and change the look with its `--ui-` tokens (`--ui-accent`, `--ui-radius`, `--ui-font`…). Without it, the part is unstyled and works the same.
