---
title: "Radio group"
group: "Components"
order: 9
description: "Pick one: native radios in a fieldset, bound two ways. The radios read the group from context and ship nothing."
---

# Radio group

<p class="lead">Pick one of a few. Native radios in a fieldset, so the arrow keys, one Tab stop and form submission come from the browser; the server writes which one is checked.</p>

<uiGallery part="radio" />

```tscl
@import uiRadioGroup from '@clarusjs/ui-primitives/radio-group.tscl'
@import uiRadio from '@clarusjs/ui-primitives/radio.tscl'

<uiRadioGroup name="size" label="Size" [(value)]="size">
  <uiRadio value="s" label="Small" />
  <uiRadio value="m" label="Medium" />
  <uiRadio value="l" label="Large" [disabled]="true" />
</uiRadioGroup>
```

- **`name`** submits the choice with its form; **`label`** is the fieldset's legend.
- **`[(value)]`** is the checked radio's value. **`(change)`** comes first with the new value; `$info.cancel()` keeps the current one.
- **Each `radio`** has a **`value`**, a **`label`** and **`disabled`**. It reads the group from [context](/guide/context), so it ships no JavaScript.
- **Styling:** `data-part` `radio-group`, `legend`, `radio` and `label`; `data-checked` and `data-disabled` on each radio's label, and `:checked` on the input.

From [`@clarusjs/ui-primitives`](/guide/ui-primitives#parts), styled by `@clarusjs/ui`: `@import '@clarusjs/ui/ui.css'` once, and change the look with its `--ui-` tokens (`--ui-accent`, `--ui-radius`, `--ui-font`…). Without it, the part is unstyled and works the same.
