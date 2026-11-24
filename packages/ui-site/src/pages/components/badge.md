---
title: "Badge"
group: "Components"
order: 6
description: "A short label, in four variants."
---

# Badge

<p class="lead">A short label, in four variants.</p>

<badgeDemo />

## Usage

<<< ../../registry/badge-demo.tscl

## Source

Copy it into your components folder (next to the others) as `badge.tscl`.

<<< ../../registry/badge.tscl

## Styling

- **On the root:** `class`, `style`, `id`, `aria-*` and `data-*` written on the tag land on its root element; `class` and `style` merge with its own.
- **Selectors:** `data-part` names `badge`; state attributes `data-variant`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="badge" />
