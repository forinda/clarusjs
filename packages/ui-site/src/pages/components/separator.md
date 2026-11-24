---
title: "Separator"
group: "Components"
order: 8
description: "A line between content, horizontal or vertical."
---

# Separator

<p class="lead">A line between content, horizontal or vertical.</p>

<separatorDemo />

## Usage

<<< ../../registry/separator-demo.tscl

## Source

Copy it into your components folder (next to the others) as `separator.tscl`.

<<< ../../registry/separator.tscl

## Styling

- **On the root:** `class`, `style`, `id`, `aria-*` and `data-*` written on the tag land on its root element; `class` and `style` merge with its own.
- **Selectors:** `data-part` names `separator`; state attributes `data-orientation`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="separator" />
