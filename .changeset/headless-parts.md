---
'@clarusjs/ui-primitives': minor
---

Headless parts, native-first (#465): `dialog.tscl` with `dialog-trigger.tscl` and `dialog-close.tscl` (a native `<dialog>` opened with the browser's command invokers: focus kept in it, the page inert, Escape and a click outside close it), `popover.tscl` with `popover-trigger.tscl` (the `popover` attribute, placed with CSS anchor positioning by `side` and `align`), `accordion-item.tscl` (`<details>`, exclusive by `group`), none of them shipping JavaScript; and `switch.tscl`, `checkbox.tscl` and `field.tscl` (small islands: native inputs, `[(checked)]` / `[(value)]`, a field's label, description and error wired by id, its error shown once left, Base UI's `data-` state). No styles: `data-part` names each element.
