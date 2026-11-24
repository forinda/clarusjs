---
title: "Toast"
group: "Components"
order: 39
description: "Short messages any island can send, announced politely, gone after a few seconds."
---

# Toast

<p class="lead">Short messages any island can send, announced politely, gone after a few seconds.</p>

<toastDemo />

## Usage

The parts come from `@clarusjs/ui-primitives`; the look is `toast.css`, imported once.

<<< ../../registry/toast-demo.tscl

## Source

Copy it next to your components as `toast.css`. It's the same as `@clarusjs/ui`'s rules for these parts, so using both looks the same.

<<< ../../registry/toast.css

## Styling

- **On the parts:** `class`, `style`, `id`, `aria-*` and `data-*` written on a part's tag (from `@clarusjs/ui-primitives`) land on its root element, merged with its own.
- **Selectors:** `data-part` names `toast-region`, `toast-list`, `toast`, `toast-message`, `toast-action`, `toast-close`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="toast" />
