---
title: "Field"
group: "Form"
order: 17
description: "A label, an input, a description and an error, wired together."
---

# Field

<p class="lead">A label, an input, a description and an error, wired together.</p>

<fieldDemo />

## Usage

<<< ../../registry/field-demo.tscl

## Examples

### With a description

A line under the label saying what goes in, linked to the input.

<fieldDescriptionDemo />

<<< ../../registry/field-description-demo.tscl

### Errors

`[show]` shows the error at once, after a submit say; without it, once the field has been left.

<fieldErrorDemo />

<<< ../../registry/field-error-demo.tscl

### Types

Any input type: the keyboard on phones follows it (email, tel, number, date, url).

<fieldTypesDemo />

<<< ../../registry/field-types-demo.tscl

## Source

Copy it into `src/components/ui/` as `field.tscl`. Its `<style global>` is the same as `@clarusjs/ui`'s rules for this part, so using both looks the same.

<<< ../../registry/field.tscl

## Styling

- **On the root:** this wrapper is an island around `field.tscl` from `@clarusjs/ui-primitives`, and attributes on its tag don't reach that part yet (a framework limit). For `class`, `style`, `id`, `aria-*` or `data-*` on it, put them on a wrapping element of your own, or use `field.tscl` from `@clarusjs/ui-primitives` directly: its root takes them, and these styles apply the same.
- **Selectors:** `data-part` names `field`, `select`, `label`, `control`, `description`, `error`, `option`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="field" />
