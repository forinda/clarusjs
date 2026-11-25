---
title: "Tooltip"
group: "Overlay"
order: 20
description: "A short hint on hover and focus."
---

# Tooltip

<p class="lead">A short hint on hover and focus.</p>

<tooltipDemo />

## Usage

The parts come from `@clarusjs/ui-primitives`; the look is `tooltip.css`, imported once.

<<< ../../registry/tooltip-demo.tscl

## Source

Copy it into `src/components/ui/` as `tooltip.css`. It's the same as `@clarusjs/ui`'s rules for these parts, so using both looks the same.

<<< ../../registry/tooltip.css

## Styling

- **On the parts:** `class`, `style`, `id`, `aria-*` and `data-*` written on a part's tag (from `@clarusjs/ui-primitives`) land on its root element, merged with its own.
- **Selectors:** `data-part` names `trigger`, `close`, `tooltip`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="tooltip" />
