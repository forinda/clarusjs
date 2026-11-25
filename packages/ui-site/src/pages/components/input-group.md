---
title: "Input group"
group: "Form"
order: 34
description: "A field with text or icons before and after it."
---

# Input group

<p class="lead">A field with text or icons before and after it.</p>

<inputGroupDemo />

## Usage

<<< ../../registry/input-group-demo.tscl

## Source

Copy it into `src/components/ui/` as `input-group.tscl`: in plain CSS, or in Tailwind classes (switch below; the Tailwind version needs `tailwind.css`).

<sourceFlavor name="input-group">

<<< ../../registry/input-group.tscl

<<< ../../registry/input-group.tw.tscl

</sourceFlavor>

## Styling

- **On the root:** `class`, `style`, `id`, `aria-*` and `data-*` written on the tag land on its root element; `class` and `style` merge with its own.
- **Selectors:** `data-part` names `input-group`, `input-group-start`, `input-group-end`; state attribute `data-variant` (`filled`, `borderless`, `underlined`).
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="input-group" />
