---
title: "Field"
group: "Components"
order: 5
description: "A labelled text input with a description and an error, wired by id, showing the error once you leave it."
---

# Field

<p class="lead">A labelled text input with a description and an error, wired by id, showing the error once you leave it.</p>

<uiGallery part="field" />

```tscl
@import uiField from '@clarusjs/ui-primitives/field.tscl'

<uiField id="name" label="Name" description="As on the invoice." [error]="errors.name" [(value)]="form.name" />
```

- **`error`** shows once the field has been left, or with **`[show]`** (after a submit). **`type`**, **`placeholder`**, **`required`**, **`name`**.
- Sends **`(blur)`**. **Styling:** `data-touched`, `data-dirty`, `data-filled`, `data-invalid` on the field; parts `label`, `control`, `description`, `error`.

From [`@clarusjs/ui-primitives`](/guide/ui-primitives#parts), styled by `@clarusjs/ui`: `@import '@clarusjs/ui/ui.css'` once, and change the look with its `--ui-` tokens (`--ui-accent`, `--ui-radius`, `--ui-font`…). Without it, the part is unstyled and works the same.
