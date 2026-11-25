---
title: "Button group"
group: "Button"
order: 33
description: "Buttons that belong together, joined into one row."
---

# Button group

<p class="lead">Buttons that belong together, joined into one row.</p>

<buttonGroupDemo />

## Usage

<<< ../../registry/button-group-demo.tscl

## Source

Copy it into `src/components/ui/` as `button-group.tscl`: in plain CSS, or in Tailwind classes (switch below; the Tailwind version needs `tailwind.css`).

<sourceFlavor name="button-group">

<<< ../../registry/button-group.tscl

<<< ../../registry/button-group.tw.tscl

</sourceFlavor>

## Styling

- **On the root:** `class`, `style`, `id`, `aria-*` and `data-*` written on the tag land on its root element; `class` and `style` merge with its own.
- **Selectors:** `data-part` names `button-group`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="button-group" />
