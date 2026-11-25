---
title: "Input"
group: "Form"
order: 2
description: "A native text field, styled, with an invalid state from aria-invalid, in three sizes."
---

# Input

<p class="lead">A native text field, styled, with an invalid state from aria-invalid, in three sizes.</p>

<inputDemo />

## Usage

<<< ../../registry/input-demo.tscl

## Examples

### Sizes

`size="sm"` or `"lg"` on the input, or `data-size` on anything around a row of controls: inputs, selects, comboboxes, toggles and fields take their height from `--ui-control-sm`, `-md` and `-lg` (30, 36 and 44px at the default density). A button takes its own `size`.

<inputSizesDemo />

<<< ../../registry/input-sizes-demo.tscl

## Source

Copy it into `src/components/ui/` as `input.tscl`.

<<< ../../registry/input.tscl

## Styling

- **On the root:** `class`, `style`, `id`, `aria-*` and `data-*` written on the tag land on its root element; `class` and `style` merge with its own.
- **Selectors:** `data-part` names `text-input`; state attributes `data-size` (`sm`, `md`, `lg`; or on anything around it).
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="input" />
