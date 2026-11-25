---
title: "Input"
group: "Form"
order: 2
description: "A native text field, styled, with an invalid state from aria-invalid."
---

# Input

<p class="lead">A native text field, styled, with an invalid state from aria-invalid.</p>

<inputDemo />

## Usage

<<< ../../registry/input-demo.tscl

## Source

Copy it into `src/components/ui/` as `input.tscl`.

<<< ../../registry/input.tscl

## Styling

- **On the root:** `class`, `style`, `id`, `aria-*` and `data-*` written on the tag land on its root element; `class` and `style` merge with its own.
- **Selectors:** `data-part` names `text-input`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="input" />
