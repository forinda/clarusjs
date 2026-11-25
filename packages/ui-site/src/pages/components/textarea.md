---
title: "Textarea"
group: "Components"
order: 3
description: "A native multi-line text field that grows with resize."
---

# Textarea

<p class="lead">A native multi-line text field that grows with resize.</p>

<textareaDemo />

## Usage

<<< ../../registry/textarea-demo.tscl

## Source

Copy it into `src/components/ui/` as `textarea.tscl`.

<<< ../../registry/textarea.tscl

## Styling

- **On the root:** `class`, `style`, `id`, `aria-*` and `data-*` written on the tag land on its root element; `class` and `style` merge with its own.
- **Selectors:** `data-part` names `textarea`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="textarea" />
