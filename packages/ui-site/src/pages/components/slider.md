---
title: "Slider"
group: "Form"
order: 28
description: "A native range input, styled."
---

# Slider

<p class="lead">A native range input, styled.</p>

<sliderDemo />

## Usage

<<< ../../registry/slider-demo.tscl

## Source

Copy it into `src/components/ui/` as `slider.tscl`.

<<< ../../registry/slider.tscl

## Styling

- **On the root:** `class`, `style`, `id`, `aria-*` and `data-*` written on the tag land on its root element; `class` and `style` merge with its own.
- **Selectors:** `data-part` names `slider`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="slider" />
