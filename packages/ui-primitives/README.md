# @clarusjs/ui-primitives

Accessible behaviours for [clarusjs](https://clarusjs.com) components, as small DOM functions. Each takes an element
(and options) and returns how to stop it; a template hands it the element with `[use]`.

```sh
pnpm add @clarusjs/ui-primitives
```

```tscl
<script>
  import { rovingFocus } from '@clarusjs/ui-primitives'
</script>

<div role="toolbar" aria-label="Formatting" [use]="(el) => rovingFocus(el)">
  <button>Bold</button> <button>Italic</button>
</div>
```

| Behaviour | Does |
|---|---|
| `rovingFocus(el, { items, orientation, loop })` | one Tab stop for a group; arrow keys (RTL-aware), Home and End; disabled items skipped |
| `typeahead(el, { items, onMatch, timeout })` | typing jumps to the next item starting with it; a repeated key cycles |
| `dismiss(el, { onDismiss, exclude })` | Escape or a press outside closes it; stacked layers; a cancelable `cl:dismiss` event |
| `enter(el)`, `exit(el)` | `data-open` / `data-closed` with `data-starting-style` / `data-ending-style` for CSS transitions |
| `focusReturn(el)` | focus goes back to where it was when it stops |
| `position(floating, anchor, { side, align, offset, flip })` | places a popup by its anchor, in the window; `data-side` and CSS variables |

Each is its own module (all six: about 2.3 KB gzip), with no dependencies. Guide: https://clarusjs.com/guide/ui-primitives

## Parts

Headless `.tscl` components on the platform's own elements, no styles. Import them under your own names:

```tscl
@import uiDialog from '@clarusjs/ui-primitives/dialog.tscl'
```

| Part | Built on |
|---|---|
| `dialog`, `dialog-trigger`, `dialog-close` | `<dialog>` and command invokers (`commandfor`): no JavaScript |
| `popover`, `popover-trigger` | the `popover` attribute and CSS anchor positioning: no JavaScript |
| `accordion-item` | `<details name>`: no JavaScript |
| `switch`, `checkbox` | a native checkbox in its label, `[(checked)]` |
| `tabs`, `tab-list`, `tab`, `tab-panel` | Radix-shaped; the parts read the selection from context, so the server writes their ARIA and `hidden`; the root is an island (`rovingFocus`) |
| `field` | label, input, description and error wired by id; Base UI's `data-touched`, `data-dirty`, `data-invalid` |
