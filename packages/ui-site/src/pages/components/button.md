---
title: "Button"
group: "Components"
order: 1
description: "A native button in six variants and three sizes."
---

# Button

<p class="lead">A native button in six variants and three sizes.</p>

<buttonDemo />

## Usage

<<< ../../registry/button-demo.tscl

## Source

Copy it into `src/components/ui/` as `button.tscl`.

<<< ../../registry/button.tscl

## Styling

- **On the root:** `class`, `style`, `id`, `aria-*` and `data-*` written on the tag land on its root element; `class` and `style` merge with its own.
- **Selectors:** `data-part` names `button`; state attributes `data-variant`, `data-size`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="button" />
