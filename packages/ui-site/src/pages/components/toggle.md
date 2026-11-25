---
title: "Toggle"
group: "Form"
order: 38
description: "A button that is on or off, alone or in a group with one Tab stop."
---

# Toggle

<p class="lead">A button that is on or off, alone or in a group with one Tab stop.</p>

<toggleDemo />

## Usage

The parts come from `@clarusjs/ui-primitives`; the look is `toggle.css`, imported once.

<<< ../../registry/toggle-demo.tscl

## Source

Copy it into `src/components/ui/` as `toggle.css`. It's the same as `@clarusjs/ui`'s rules for these parts, so using both looks the same.

<<< ../../registry/toggle.css

## Styling

- **On the parts:** `class`, `style`, `id`, `aria-*` and `data-*` written on a part's tag (from `@clarusjs/ui-primitives`) land on its root element, merged with its own.
- **Selectors:** `data-part` names `toggle`, `toggle-item`, `toggle-group`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="toggle" />
