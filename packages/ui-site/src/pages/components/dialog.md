---
title: "Dialog"
group: "Overlay"
order: 18
description: "A modal dialog on native <dialog>: focus kept in it, Escape and a click outside close it."
---

# Dialog

<p class="lead">A modal dialog on native <code>&lt;dialog&gt;</code>: focus kept in it, Escape and a click outside close it.</p>

<dialogDemo />

## Usage

The parts come from `@clarusjs/ui-primitives`; the look is `dialog.css`, imported once.

<<< ../../registry/dialog-demo.tscl

## Examples

### Backdrop

`data-backdrop` on the dialog: `light`, `dark`, `blur` or `none` (the default dims the page by 45%). Set `--ui-backdrop-opacity` and `--ui-backdrop-blur` on `:root` for a site-wide default.

<dialogBackdropDemo />

<<< ../../registry/dialog-backdrop-demo.tscl

## Source

Copy it into `src/components/ui/` as `dialog.css`. It's the same as `@clarusjs/ui`'s rules for these parts, so using both looks the same.

<<< ../../registry/dialog.css

## Styling

- **On the parts:** `class`, `style`, `id`, `aria-*` and `data-*` written on a part's tag (from `@clarusjs/ui-primitives`) land on its root element, merged with its own.
- **Selectors:** `data-part` names `trigger`, `close`, `dialog`, `title`; `data-backdrop` (`light`, `dark`, `blur`, `none`) picks the backdrop.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="dialog" />
