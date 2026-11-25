---
title: "Checkbox"
group: "Form"
order: 14
description: "A native checkbox with its label."
---

# Checkbox

<p class="lead">A native checkbox with its label.</p>

<checkboxDemo />

## Usage

<<< ../../registry/checkbox-demo.tscl

## Source

Copy it into `src/components/ui/` as `checkbox.tscl`. Its `<style global>` is the same as `@clarusjs/ui`'s rules for this part, so using both looks the same.

<<< ../../registry/checkbox.tscl

## Styling

- **On the root:** this wrapper is an island around `checkbox.tscl` from `@clarusjs/ui-primitives`, and attributes on its tag don't reach that part yet (a framework limit). For `class`, `style`, `id`, `aria-*` or `data-*` on it, put them on a wrapping element of your own, or use `checkbox.tscl` from `@clarusjs/ui-primitives` directly: its root takes them, and these styles apply the same.
- **Selectors:** `data-part` names `switch`, `checkbox`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="checkbox" />
