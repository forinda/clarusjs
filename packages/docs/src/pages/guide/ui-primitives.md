---
title: "UI primitives"
group: "Interactivity"
order: 11
description: "Accessible behaviours and headless parts from @clarusjs/ui-primitives: roving focus, typeahead, dismiss, transitions and positioning with [use]; dialog, popover, accordion, tabs, switch, checkbox and field."
---

# UI primitives

<p class="lead"><code>@clarusjs/ui-primitives</code> holds the behaviours accessible components share: arrow keys through a toolbar, typing to jump in a list, closing a popup on Escape. Each one is a function of an element that returns how to stop it, and a template hands it the element with <code>[use]</code>.</p>

```sh
pnpm add @clarusjs/ui-primitives
```

```tscl
<script>
  import { rovingFocus } from '@clarusjs/ui-primitives'
</script>

<div role="toolbar" aria-label="Formatting" [use]="(el) => rovingFocus(el)">
  <button>Bold</button> <button>Italic</button> <button>Clear</button>
</div>
```

<primitivesDemo />

Tab into the toolbar, then use the arrow keys; Underline is disabled, so it's skipped. In the list, type `b` (again for the next b), and the arrow keys. Open *Details*, then press Escape or click outside: focus goes back to the button.

## `[use]`

`[use]="fn"` on an element in an island calls `fn(element)` in the browser once the island attaches. What `fn` returns, a function, runs when the element goes: its `@if` branch closes, its `@for` row is removed, or the island is. Give a list to run several: `[use]="[focusReturn, enter]"`.

- The server renders the element as written, with a `data-cl-u` marker. Nothing runs there.
- `fn` runs once, not again when state it reads changes.
- `clarusjs check` types the element by its tag: `(el) => el.rows` on a `<p>` is an error.

`[use]` takes any function, not only these: `[use]="(el) => el.focus()"`.

## The behaviours

Each is its own module, so an island ships only the ones it imports (all six are about 2.3 KB gzip).

### rovingFocus

`rovingFocus(el, { items, orientation, loop, onMove })`: one Tab stop for a group. The current item has `tabindex="0"`, the others `-1`; arrow keys move between the enabled items (by `orientation`: `'horizontal'`, `'vertical'` or `'both'`, flipped in right-to-left text), Home and End jump, and `loop: false` stops at the ends. The current item is the one focused last, else one marked `aria-selected`, `aria-checked`, `aria-current` or `data-highlighted`.

### typeahead

`typeahead(el, { items, onMatch, text, timeout })`: typing moves to the next item whose text starts with what was typed. The same key again (`b`, `b`) cycles through the items starting with it; a pause (500 ms) starts over. By default the match is focused.

### dismiss

`dismiss(el, { onDismiss, exclude })`: calls `onDismiss(reason, event)` on Escape (`'escape-key'`) or a press outside `el` (`'outside-press'`). Layers stack: Escape closes the topmost one only, and a press inside a popup opened from this one isn't outside it. `exclude()` lists elements that don't count as outside, like the button that opens it (which toggles it itself). Before closing, `el` gets a cancelable `cl:dismiss` event: `preventDefault()` keeps it open.

### enter and exit

`enter(el)` marks an element `data-open`, with `data-starting-style` for its first frame; `exit(el)` marks it `data-closed` with `data-ending-style` until its animations finish (await it, then remove the element). Style the transition from those attributes:

```css
.popup { transition: opacity 150ms; }
.popup[data-starting-style], .popup[data-ending-style] { opacity: 0; }
```

### focusReturn

`focusReturn(el)` remembers what has focus; when it stops, focus goes back there (if focus is in `el`, or nowhere). Put it first in a popup's `[use]`, so it runs last.

### position

`position(floating, anchor, { side, align, offset, flip })` places `floating` next to `anchor` (fixed), inside the window, on scroll and resize too, and flips to the other side when there's no room. It sets `data-side` and `data-align`, and the CSS variables `--anchor-width`, `--anchor-height`, `--available-width`, `--available-height` and `--transform-origin`.

## Parts

Headless components in the same package, as `.tscl` files: they render the platform's own elements with their ARIA and state attributes, and no styles. Import them under a name of your own (`<dialog>` and `<switch>` are already HTML and SVG tags):

```tscl
@import uiDialog from '@clarusjs/ui-primitives/dialog.tscl'
@import uiDialogTrigger from '@clarusjs/ui-primitives/dialog-trigger.tscl'
@import uiDialogClose from '@clarusjs/ui-primitives/dialog-close.tscl'

<uiDialogTrigger target="confirm">Delete file…</uiDialogTrigger>
<uiDialog id="confirm">
  @slot('title') { Delete this file? }
  <p>It can't be undone.</p>
  <uiDialogClose target="confirm">Cancel</uiDialogClose>
</uiDialog>
```

<partsDemo />

| Part | Built on | JavaScript |
|---|---|---|
| `dialog.tscl`, `dialog-trigger.tscl`, `dialog-close.tscl` | `<dialog>` opened with the browser's command invokers (`commandfor`, `command="show-modal"`); focus kept in it, the page inert, Escape and (`dismissible`) a click outside close it | none |
| `popover.tscl`, `popover-trigger.tscl` | the `popover` attribute and `popovertarget`, placed by CSS anchor positioning (`side`, `align`), flipping when there's no room | none |
| `accordion-item.tscl` | `<details>`; the same `group` makes items exclusive | none |
| `tabs.tscl`, `tab-panel.tscl` | a tab list with arrow keys, Home and End (`rovingFocus`), over panels the page writes: each is server HTML with its ARIA and `hidden`, so nothing jumps; `[(value)]`, `(change)` ([Tabs](/components/tabs)) | a small island (the list) |
| `switch.tscl`, `checkbox.tscl` | a native checkbox in its label (`role="switch"` for the switch), `[(checked)]` | a small island |
| `field.tscl` | label, input, description and error wired by id; the error shows once left, or with `[show]` | a small island |
| `select.tscl` | a native `<select>`, the customizable one (`appearance: base-select`) where the browser has it; `[(value)]`, `(change)` | a small island |
| `combobox.tscl` | an input that filters a list as you type: one pick or several, options from the server, `(change)` that a parent can cancel ([Forms](/guide/forms#a-combobox)) | an island |

- **Style them from their attributes:** `data-part` names each element; state is in the platform's own (`dialog[open]`, `:popover-open`, `details[open]`, `:checked`) and in Base UI's `data-` names where it isn't (`data-checked`, `data-disabled`, `data-side`, `data-align`; on a field, `data-touched`, `data-dirty`, `data-filled`, `data-invalid`).
- **Attributes you add land on their root** (`id`, `aria-*`, `data-*`: see [Attributes on a component](/guide/components#attributes-on-a-component)), and a `class` merges.
- **Field sends `(blur)`** ([component events](/guide/events#from-a-child-island-to-its-parent)).

Tabs, menus and tooltips, which need JavaScript around content you write, come next.
