---
title: "Resizable"
group: "Panel"
order: 20
description: "Two panels and a handle between them, dragged with a pointer or moved with the keyboard."
---

# Resizable

<p class="lead">Two panels and a handle between them, dragged with a pointer or moved with the keyboard.</p>

<resizableDemo />

## Usage

Fill the `start` and `end` slots. `size` is the first panel's share in percent (bind it with `[(size)]` to keep it, say, in a cookie), held between `min` and `max`. The handle is a focusable `separator` with its value, named by `label`: the arrow keys move it by `step`, Home and End go to the limits. Give the component a height (or put it in one): it fills its box.

<<< ../../registry/resizable-demo.tscl

## Examples

### Vertical

`orientation="vertical"` stacks the panels; Up and Down move the handle.

<resizableVerticalDemo />

<<< ../../registry/resizable-vertical-demo.tscl

## Source

Copy it into `src/components/ui/` as `resizable.tscl`: in plain CSS, or in Tailwind classes (switch below; the Tailwind version needs `tailwind.css`).

<sourceFlavor name="resizable">

<<< ../../registry/resizable.tscl

<<< ../../registry/resizable.tw.tscl

</sourceFlavor>

## Styling

- **On the root:** `class`, `style`, `id`, `aria-*` and `data-*` written on the tag land on its root element; `class` and `style` merge with its own.
- **Selectors:** `data-part` names `resizable`, `resizable-panel` and `resizable-handle`; state attributes `data-orientation` and, while dragging, `data-dragging` on the root. The first panel's share is `--ui-split`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="resizable" />
