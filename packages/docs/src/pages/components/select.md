---
title: "Select"
group: "Components"
order: 6
description: "A native <select>: the customizable select where the browser has it, the usual one elsewhere."
---

# Select

<p class="lead">A native &lt;select&gt;: the customizable select where the browser has it, the usual one elsewhere.</p>

<uiGallery part="select" />

```tscl
@import uiSelect from '@clarusjs/ui-primitives/select.tscl'

<uiSelect id="size" label="Size" [options]="sizes" [(value)]="form.size" />
```

- **`options`**: `{ value, label, disabled? }`; **`placeholder`**, **`name`**, **`disabled`**. Sends **`(change)`**.
- **Styling:** where supported, `::picker(select)` and the options; parts `select`, `label`, `control`, `option`.

From [`@clarusjs/ui-primitives`](/guide/ui-primitives#parts), styled by `@clarusjs/ui`: `@import '@clarusjs/ui/ui.css'` once, and change the look with its `--ui-` tokens (`--ui-accent`, `--ui-radius`, `--ui-font`…). Without it, the part is unstyled and works the same.
