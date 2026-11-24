---
title: "Card"
group: "Components"
order: 5
description: "A box with a header, a body and a footer."
---

# Card

<p class="lead">A box with a header, a body and a footer.</p>

<cardDemo />

## Usage

<<< ../../registry/card-demo.tscl

## Source

Copy it into your components folder (next to the others) as `card.tscl`.

<<< ../../registry/card.tscl

## Styling

- **On the root:** `class`, `style`, `id`, `aria-*` and `data-*` written on the tag land on its root element; `class` and `style` merge with its own.
- **Inner pieces:** `parts` takes an object of attributes (`class`, `style`, `data-*`) for each of `header`, `body`, `footer`, spread on that piece: `[parts]="{ header: { class: 'my-header' } }"`.
- **Selectors:** `data-part` names `card`, `card-header`, `card-body`, `card-footer`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="card" />
