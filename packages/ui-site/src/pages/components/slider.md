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

## Examples

### Showing its value

An `<output>` beside the label, kept in step as it moves.

<sliderValueDemo />

<<< ../../registry/slider-value-demo.tscl

### Steps and disabled

`step` with tick marks from a `<datalist>` (`list`), and a disabled one.

<sliderStepsDemo />

<<< ../../registry/slider-steps-demo.tscl

## API

<componentApi name="slider" />

## Source

Copy it into `src/components/ui/` as `slider.tscl`: in plain CSS, or in Tailwind classes (switch below; the Tailwind version needs `tailwind.css`).

<sourceFlavor name="slider">

<<< ../../registry/slider.tscl

<<< ../../registry/slider.tw.tscl

</sourceFlavor>

## Styling

- **On the root:** `class`, `style`, `id`, `aria-*` and `data-*` written on the tag land on its root element; `class` and `style` merge with its own.
- **Selectors:** `data-part` names `slider`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="slider" />
