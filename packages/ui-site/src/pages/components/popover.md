---
title: "Popover"
group: "Overlay"
order: 19
description: "A panel anchored to its trigger, on the popover attribute."
---

# Popover

<p class="lead">A panel anchored to its trigger, on the popover attribute.</p>

<popoverDemo />

## Usage

The parts come from `@clarusjs/ui-primitives`; the look is `popover.css`, imported once.

<<< ../../registry/popover-demo.tscl

## API

<componentApi name="popover" />

## Source

Copy it into `src/components/ui/` as `popover.css`. It's the same as `@clarusjs/ui`'s rules for these parts, so using both looks the same. Or the Tailwind version (switch below): the same look in Tailwind utilities, `popover.tw.css`, imported where Tailwind runs.

<sourceFlavor name="popover">

<<< ../../registry/popover.css

<<< ../../registry/popover.tw.css

</sourceFlavor>

## Styling

- **On the parts:** `class`, `style`, `id`, `aria-*` and `data-*` written on a part's tag (from `@clarusjs/ui-primitives`) land on its root element, merged with its own.
- **Selectors:** `data-part` names `trigger`, `close`, `popover`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="popover" />
