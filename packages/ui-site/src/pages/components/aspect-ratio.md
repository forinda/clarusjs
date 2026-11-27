---
title: "Aspect ratio"
group: "Panel"
order: 35
description: "A box that keeps its shape as its width changes."
---

# Aspect ratio

<p class="lead">A box that keeps its shape as its width changes.</p>

<aspectRatioDemo />

## Usage

<<< ../../registry/aspect-ratio-demo.tscl

## Examples

### Any ratio

`ratio` takes any CSS ratio: `"1/1"`, `"4/3"`, `"16/9"`, `"21/9"`, or `"3/4"` for portrait. Bind it to change the shape.

<aspectRatioRatiosDemo />

<<< ../../registry/aspect-ratio-ratios-demo.tscl

## API

<componentApi name="aspect-ratio" />

## Source

Copy it into `src/components/ui/` as `aspect-ratio.tscl`: in plain CSS, or in Tailwind classes (switch below; the Tailwind version needs `tailwind.css`).

<sourceFlavor name="aspect-ratio">

<<< ../../registry/aspect-ratio.tscl

<<< ../../registry/aspect-ratio.tw.tscl

</sourceFlavor>

## Styling

- **On the root:** `class`, `style`, `id`, `aria-*` and `data-*` written on the tag land on its root element; `class` and `style` merge with its own.
- **Selectors:** `data-part` names `aspect-ratio`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="aspect-ratio" />
