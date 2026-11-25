---
title: "Input"
group: "Form"
order: 2
description: "A native text field in four variants and three sizes, with icons, add-ons, states and the usual patterns."
---

# Input

<p class="lead">A native text field in four variants and three sizes, with icons, add-ons, states and the usual patterns.</p>

<inputDemo />

## Usage

<<< ../../registry/input-demo.tscl

## Examples

### Variants

Outline (the default), filled, borderless and underlined. Input group takes the same `variant`.

<inputVariantsDemo />

<<< ../../registry/input-variants-demo.tscl

### Sizes

`size="sm"` or `"lg"` on the input, or `data-size` on anything around a row of controls: inputs, selects, comboboxes, toggles and fields take their height from `--ui-control-sm`, `-md` and `-lg` (30, 36 and 44px at the default density). A button takes its own `size`.

<inputSizesDemo />

<<< ../../registry/input-sizes-demo.tscl

### Icons

An icon (or a key) before or after the text: Input group's `start` and `end` slots.

<inputIconsDemo />

<<< ../../registry/input-icons-demo.tscl

### Add-ons

Text joined to the field, and a field joined to its button.

<inputAddonsDemo />

<<< ../../registry/input-addons-demo.tscl

### States

Enabled, disabled, read-only; an error is `aria-invalid` with its message linked by `aria-describedby`, a warning `status="warning"`.

<inputStatesDemo />

<<< ../../registry/input-states-demo.tscl

### Password

A button that shows and hides it, saying which with `aria-pressed`.

<inputPasswordDemo />

<<< ../../registry/input-password-demo.tscl

### Clear

A button that empties the field and puts the focus back in it; hidden while it's empty.

<inputClearDemo />

<<< ../../registry/input-clear-demo.tscl

### Character count

A count under the field, linked to it, read politely rather than on every key.

<inputCountDemo />

<<< ../../registry/input-count-demo.tscl

### Search

A search form: the field and its button, which waits while the search runs.

<inputSearchDemo />

<<< ../../registry/input-search-demo.tscl

## Source

Copy it into `src/components/ui/` as `input.tscl`.

<<< ../../registry/input.tscl

## Styling

- **On the root:** `class`, `style`, `id`, `aria-*` and `data-*` written on the tag land on its root element; `class` and `style` merge with its own.
- **Selectors:** `data-part` names `text-input` (with no box of its own inside an `input-group`); state attributes `data-size` (`sm`, `md`, `lg`; or on anything around it), `data-variant` (`filled`, `borderless`, `underlined`), `data-status` (`warning`), and `aria-invalid`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="input" />
