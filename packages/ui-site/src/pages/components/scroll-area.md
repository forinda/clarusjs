---
title: "Scroll area"
group: "Panel"
order: 21
description: "A box that scrolls, with thin themed scrollbars and shadows at an edge with more to see. CSS only."
---

# Scroll area

<p class="lead">A box that scrolls, with thin themed scrollbars and shadows at an edge with more to see. CSS only.</p>

<scrollAreaDemo />

## Usage

Give it a height (or, horizontal, a width) with `class` or `style`. It's a region named by `label`, and focusable, so the keyboard scrolls it too (arrows, PageUp and PageDown, Space). The scrollbars are the browser's own, thin and in the theme's colours: no JavaScript, and touch, wheel and keyboard all work as they always do. The edge shadows are two backgrounds that scroll with the content: in a box whose background isn't the page's, set `--ui-scroll-cover` to it. They sit behind the content, so opaque content (an image) covers them.

<<< ../../registry/scroll-area-demo.tscl

## Examples

### Horizontal

`orientation="horizontal"`: a row wider than its box scrolls sideways (`both` scrolls either way).

<scrollAreaHorizontalDemo />

<<< ../../registry/scroll-area-horizontal-demo.tscl

## Source

Copy it into `src/components/ui/` as `scroll-area.tscl`: in plain CSS, or in Tailwind classes (switch below; the Tailwind version needs `tailwind.css`).

<sourceFlavor name="scroll-area">

<<< ../../registry/scroll-area.tscl

<<< ../../registry/scroll-area.tw.tscl

</sourceFlavor>

## Styling

- **On the root:** `class`, `style`, `id`, `aria-*` and `data-*` written on the tag land on its root element; `class` and `style` merge with its own.
- **Selectors:** `data-part` names `scroll-area`; state attribute `data-orientation`. Variables `--ui-scroll-cover` (the background the shadows hide behind) and `--ui-scroll-shade` (the shadow).
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="scroll-area" />
