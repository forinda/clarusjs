---
title: "Switch"
group: "Components"
order: 15
description: "An on/off switch on a native checkbox."
---

# Switch

<p class="lead">An on/off switch on a native checkbox.</p>

<switchDemo />

## Usage

<<< ../../registry/switch-demo.tscl

## Source

Copy it into `src/components/ui/` as `switch.tscl`. Its `<style global>` is the same as `@clarusjs/ui`'s rules for this part, so using both looks the same.

<<< ../../registry/switch.tscl

## Styling

- **On the root:** this wrapper is an island around `switch.tscl` from `@clarusjs/ui-primitives`, and attributes on its tag don't reach that part yet (a framework limit). For `class`, `style`, `id`, `aria-*` or `data-*` on it, put them on a wrapping element of your own, or use `switch.tscl` from `@clarusjs/ui-primitives` directly: its root takes them, and these styles apply the same.
- **Selectors:** `data-part` names `switch`, `checkbox`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="switch" />
