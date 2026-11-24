---
title: "Collapsible"
group: "Components"
order: 31
description: "Content that opens and closes under a trigger, on native details."
---

# Collapsible

<p class="lead">Content that opens and closes under a trigger, on native details.</p>

<collapsibleDemo />

## Usage

<<< ../../registry/collapsible-demo.tscl

## Source

Copy it next to your components as `collapsible.tscl`.

<<< ../../registry/collapsible.tscl

## Styling

- **On the root:** `class`, `style`, `id`, `aria-*` and `data-*` written on the tag land on its root element; `class` and `style` merge with its own.
- **Selectors:** `data-part` names `collapsible`, `collapsible-trigger`, `collapsible-content`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="collapsible" />
