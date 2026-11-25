---
title: "Skeleton"
group: "Misc"
order: 9
description: "A pulsing placeholder while content loads."
---

# Skeleton

<p class="lead">A pulsing placeholder while content loads.</p>

<skeletonDemo />

## Usage

<<< ../../registry/skeleton-demo.tscl

## Source

Copy it into `src/components/ui/` as `skeleton.tscl`.

<<< ../../registry/skeleton.tscl

## Styling

- **On the root:** `class`, `style`, `id`, `aria-*` and `data-*` written on the tag land on its root element; `class` and `style` merge with its own.
- **Selectors:** `data-part` names `skeleton`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="skeleton" />
