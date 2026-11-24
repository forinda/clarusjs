---
title: "Combobox"
group: "Components"
order: 7
description: "An input that filters a list as you type: one pick or several, options from the server, and a change the parent can cancel."
---

# Combobox

<p class="lead">An input that filters a list as you type: one pick or several, options from the server, and a change the parent can cancel.</p>

<uiGallery part="combobox" />

```tscl
@import uiCombobox from '@clarusjs/ui-primitives/combobox.tscl'

<uiCombobox [id]="'fruit'" [label]="'Fruit'" [options]="fruits" [(value)]="form.fruit" />
```

- **`multiple`** with `[(values)]`; **`src`** for options from the server. Sends **`(change)`**, which a parent can cancel. See [Forms](/guide/forms#a-combobox).
- **Styling:** parts `combobox`, `label`, `control`, `chip`, `input`, `listbox`, `option` (`data-highlighted` on the active one), `status`.

From [`@clarusjs/ui-primitives`](/guide/ui-primitives#parts), styled by `@clarusjs/ui`: `@import '@clarusjs/ui/ui.css'` once, and change the look with its `--ui-` tokens (`--ui-accent`, `--ui-radius`, `--ui-font`…). Without it, the part is unstyled and works the same.
