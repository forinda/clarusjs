---
title: "Menu"
group: "Menu"
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

Copy it into `src/components/ui/` as `menu.css`. It's the same as `@clarusjs/ui`'s rules for these parts, so using both looks the same. Or the Tailwind version (switch below): the same look in Tailwind utilities, `menu.tw.css`, imported where Tailwind runs.

<sourceFlavor name="menu">

<<< ../../registry/menu.css

<<< ../../registry/menu.tw.css

</sourceFlavor>

## Styling

- **On the parts:** `class`, `style`, `id`, `aria-*` and `data-*` written on a part's tag (from `@clarusjs/ui-primitives`) land on its root element, merged with its own.
- **Selectors:** `data-part` names `trigger`, `close`, `menu`, `menu-list`, `menu-item`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="menu" />
