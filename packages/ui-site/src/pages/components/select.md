---
title: "Select"
group: "Form"
order: 23
description: "A native select with its label, bound two ways."
---

# Select

<p class="lead">A native select with its label, bound two ways.</p>

<selectDemo />

## Usage

The parts come from `@clarusjs/ui-primitives`; the look is `select.css`, imported once.

<<< ../../registry/select-demo.tscl

## Examples

### States

A placeholder until something is chosen, an option that can't be picked, and the whole select disabled.

<selectStatesDemo />

<<< ../../registry/select-states-demo.tscl

## Source

Copy it into `src/components/ui/` as `select.css`. It's the same as `@clarusjs/ui`'s rules for these parts, so using both looks the same. Or the Tailwind version (switch below): the same look in Tailwind utilities, `select.tw.css`, imported where Tailwind runs.

<sourceFlavor name="select">

<<< ../../registry/select.css

<<< ../../registry/select.tw.css

</sourceFlavor>

## Styling

- **On the parts:** `class`, `style`, `id`, `aria-*` and `data-*` written on a part's tag (from `@clarusjs/ui-primitives`) land on its root element, merged with its own.
- **Selectors:** `data-part` names `field`, `select`, `label`, `control`, `description`, `error`, `option`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="select" />
