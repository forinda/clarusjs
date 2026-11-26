---
title: "Combobox"
group: "Form"
order: 24
description: "A text field that filters a list of options as you type."
---

# Combobox

<p class="lead">A text field that filters a list of options as you type.</p>

<comboboxDemo />

## Usage

The parts come from `@clarusjs/ui-primitives`; the look is `combobox.css`, imported once.

<<< ../../registry/combobox-demo.tscl

## Examples

### Several values

`[multiple]`: each pick becomes a chip; Backspace in the empty input removes the last.

<comboboxMultipleDemo />

<<< ../../registry/combobox-multiple-demo.tscl

## Source

Copy it into `src/components/ui/` as `combobox.css`. It's the same as `@clarusjs/ui`'s rules for these parts, so using both looks the same. Or the Tailwind version (switch below): the same look in Tailwind utilities, `combobox.tw.css`, imported where Tailwind runs.

<sourceFlavor name="combobox">

<<< ../../registry/combobox.css

<<< ../../registry/combobox.tw.css

</sourceFlavor>

## Styling

- **On the parts:** `class`, `style`, `id`, `aria-*` and `data-*` written on a part's tag (from `@clarusjs/ui-primitives`) land on its root element, merged with its own.
- **Selectors:** `data-part` names `field`, `select`, `label`, `control`, `description`, `error`, `option`, `combobox`, `input`, `chip`, `listbox`, `status`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="combobox" />
