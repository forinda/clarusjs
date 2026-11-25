---
title: "Aspect ratio"
group: "Panel"
order: 35
description: "A box that keeps its shape as its width changes."
---

# Aspect ratio

<p class="lead">A box that keeps its shape as its width changes.</p>

<aspectRatioDemo />

## Usage

<<< ../../registry/aspect-ratio-demo.tscl

## Source

Copy it into `src/components/ui/` as `aspect-ratio.tscl`.

<<< ../../registry/aspect-ratio.tscl

## Styling

- **On the root:** `class`, `style`, `id`, `aria-*` and `data-*` written on the tag land on its root element; `class` and `style` merge with its own.
- **Selectors:** `data-part` names `aspect-ratio`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="aspect-ratio" />
