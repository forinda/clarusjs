---
title: "Menu"
group: "Components"
order: 21
description: "A menu of actions: arrow keys, typeahead, Escape."
---

# Menu

<p class="lead">A menu of actions: arrow keys, typeahead, Escape.</p>

<menuDemo />

## Usage

The parts come from `@clarusjs/ui-primitives`; the look is `menu.css`, imported once.

<<< ../../registry/menu-demo.tscl

## Source

Copy it next to your components as `menu.css`. It's the same as `@clarusjs/ui`'s rules for these parts, so using both looks the same.

<<< ../../registry/menu.css

## Styling

- **On the parts:** `class`, `style`, `id`, `aria-*` and `data-*` written on a part's tag (from `@clarusjs/ui-primitives`) land on its root element, merged with its own.
- **Selectors:** `data-part` names `trigger`, `close`, `menu`, `menu-list`, `menu-item`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="menu" />
