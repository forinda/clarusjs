---
title: "Label"
group: "Components"
order: 4
description: "A native label for a field."
---

# Label

<p class="lead">A native label for a field.</p>

<labelDemo />

## Usage

<<< ../../registry/label-demo.tscl

## Source

Copy it into `src/components/ui/` as `label.tscl`.

<<< ../../registry/label.tscl

## Styling

- **On the root:** `class`, `style`, `id`, `aria-*` and `data-*` written on the tag land on its root element; `class` and `style` merge with its own.
- **Selectors:** `data-part` names `form-label`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="label" />
