---
title: "Meter"
group: "Misc"
order: 26
description: "A native meter for a value in a known range."
---

# Meter

<p class="lead">A native meter for a value in a known range.</p>

<meterDemo />

## Usage

<<< ../../registry/meter-demo.tscl

## API

<componentApi name="meter" />

## Source

Copy it into `src/components/ui/` as `meter.tscl`: in plain CSS, or in Tailwind classes (switch below; the Tailwind version needs `tailwind.css`).

<sourceFlavor name="meter">

<<< ../../registry/meter.tscl

<<< ../../registry/meter.tw.tscl

</sourceFlavor>

## Styling

- **On the root:** `class`, `style`, `id`, `aria-*` and `data-*` written on the tag land on its root element; `class` and `style` merge with its own.
- **Selectors:** `data-part` names `meter`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="meter" />
