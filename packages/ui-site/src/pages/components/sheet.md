---
title: "Sheet"
group: "Overlay"
order: 36
description: "A dialog against one side of the screen, for navigation, filters or a form."
---

# Sheet

<p class="lead">A dialog against one side of the screen, for navigation, filters or a form.</p>

<sheetDemo />

## Usage

The parts come from `@clarusjs/ui-primitives`; the look is `sheet.css`, imported once.

<<< ../../registry/sheet-demo.tscl

## Source

Copy it into `src/components/ui/` as `sheet.css`. It's the same as `@clarusjs/ui`'s rules for these parts, so using both looks the same. Or the Tailwind version (switch below): the same look in Tailwind utilities, `sheet.tw.css`, imported where Tailwind runs.

<sourceFlavor name="sheet">

<<< ../../registry/sheet.css

<<< ../../registry/sheet.tw.css

</sourceFlavor>

## Styling

- **On the parts:** `class`, `style`, `id`, `aria-*` and `data-*` written on a part's tag (from `@clarusjs/ui-primitives`) land on its root element, merged with its own.
- **Selectors:** `data-part` names `trigger`, `close`, `dialog`, `title`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="sheet" />
