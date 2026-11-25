---
title: "Card"
group: "Panel"
order: 5
description: "A box with a header, a body and a footer."
---

# Card

<p class="lead">A box with a header, a body and a footer.</p>

<cardDemo />

## Usage

<<< ../../registry/card-demo.tscl

## Examples

### With actions

The footer holds what the card lets you do.

<cardActionsDemo />

<<< ../../registry/card-actions-demo.tscl

### Stat

A number and its trend: the building block of a dashboard.

<cardStatDemo />

<<< ../../registry/card-stat-demo.tscl

## Source

Copy it into `src/components/ui/` as `card.tscl`: in plain CSS, or in Tailwind classes (switch below; the Tailwind version needs `tailwind.css`).

<sourceFlavor name="card">

<<< ../../registry/card.tscl

<<< ../../registry/card.tw.tscl

</sourceFlavor>

## Styling

- **On the root:** `class`, `style`, `id`, `aria-*` and `data-*` written on the tag land on its root element; `class` and `style` merge with its own.
- **Inner pieces:** `parts` takes an object of attributes (`class`, `style`, `data-*`) for each of `header`, `body`, `footer`, spread on that piece: `[parts]="{ header: { class: 'my-header' } }"`.
- **Selectors:** `data-part` names `card`, `card-header`, `card-body`, `card-footer`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="card" />
