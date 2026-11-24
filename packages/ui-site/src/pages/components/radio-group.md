---
title: "Radio group"
group: "Components"
order: 16
description: "Native radios in a fieldset: one choice from a few."
---

# Radio group

<p class="lead">Native radios in a fieldset: one choice from a few.</p>

<radioGroupDemo />

## Usage

<<< ../../registry/radio-group-demo.tscl

## Source

Copy it into your components folder (next to the others) as `radio-group.tscl`. Its `<style global>` is the same as `@clarusjs/ui`'s rules for this part, so using both looks the same.

<<< ../../registry/radio-group.tscl

## Styling

- **On the root:** this wrapper is an island around `radio-group.tscl` from `@clarusjs/ui-primitives`, and attributes on its tag don't reach that part yet (a framework limit). For `class`, `style`, `id`, `aria-*` or `data-*` on it, put them on a wrapping element of your own, or use `radio-group.tscl` from `@clarusjs/ui-primitives` directly: its root takes them, and these styles apply the same.
- **Selectors:** `data-part` names `radio-group`, `legend`, `radio`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="radio-group" />
