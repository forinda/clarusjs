---
title: "UI primitives"
group: "Interactivity"
order: 11
description: "Accessible behaviours from @clarusjs/ui-primitives, handed elements with [use]: roving focus, typeahead, dismiss, enter and exit, focus return and positioning."
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

These are the first part of a component library: headless parts built on them (and on the platform: `<dialog>`, the `popover` attribute) come next.
