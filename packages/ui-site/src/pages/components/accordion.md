---
title: "Accordion"
group: "Panel"
order: 13
description: "Questions that open one at a time, on native details."
---

# Accordion

<p class="lead">Questions that open one at a time, on native details.</p>

<accordionDemo />

## Usage

<<< ../../registry/accordion-demo.tscl

## API

<componentApi name="accordion" />

## Source

Copy it into `src/components/ui/` as `accordion.tscl`. Its `<style global>` is the same as `@clarusjs/ui`'s rules for this part, so using both looks the same. Or the Tailwind version (switch below): the same look in Tailwind utilities, `accordion.tw.tscl` copied as `accordion.tscl` with `accordion.tw.css` beside it.

<sourceFlavor name="accordion">

<<< ../../registry/accordion.tscl

<<< ../../registry/accordion.tw.tscl

<<< ../../registry/accordion.tw.css

</sourceFlavor>

## Styling

- **On the root:** `class`, `style`, `id`, `aria-*` and `data-*` written on the tag land on its root element; `class` and `style` merge with its own.
- **Selectors:** `data-part` names `trigger`, `close`, `accordion-item`, `panel`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="accordion" />
