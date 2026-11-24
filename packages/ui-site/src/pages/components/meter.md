---
title: "Meter"
group: "Components"
order: 26
description: "A native meter for a value in a known range."
---

# Meter

<p class="lead">A native meter for a value in a known range.</p>

<meterDemo />

## Usage

<<< ../../registry/meter-demo.tscl

## Source

Copy it next to your components as `meter.tscl`.

<<< ../../registry/meter.tscl

## Styling

- **On the root:** `class`, `style`, `id`, `aria-*` and `data-*` written on the tag land on its root element; `class` and `style` merge with its own.
- **Selectors:** `data-part` names `meter`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="meter" />
