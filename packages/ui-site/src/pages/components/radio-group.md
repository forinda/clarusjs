---
title: "Radio group"
group: "Form"
order: 16
description: "Native radios in a fieldset: one choice from a few."
---

# Radio group

<p class="lead">Native radios in a fieldset: one choice from a few.</p>

<radioGroupDemo />

## Usage

<<< ../../registry/radio-group-demo.tscl

## Examples

### A disabled option

An option that can't be chosen today, still listed so people know it exists.

<radioGroupDisabledDemo />

<<< ../../registry/radio-group-disabled-demo.tscl

## API

<componentApi name="radio-group" />

## Source

Copy it into `src/components/ui/` as `radio-group.tscl`. Its `<style global>` is the same as `@clarusjs/ui`'s rules for this part, so using both looks the same. Or the Tailwind version (switch below): the same look in Tailwind utilities, `radio-group.tw.tscl` copied as `radio-group.tscl` with `radio-group.tw.css` beside it.

<sourceFlavor name="radio-group">

<<< ../../registry/radio-group.tscl

<<< ../../registry/radio-group.tw.tscl

<<< ../../registry/radio-group.tw.css

</sourceFlavor>

## Styling

- **On the root:** this wrapper is an island around `radio-group.tscl` from `@clarusjs/ui-primitives`, and attributes on its tag don't reach that part yet (a framework limit). For `class`, `style`, `id`, `aria-*` or `data-*` on it, put them on a wrapping element of your own, or use `radio-group.tscl` from `@clarusjs/ui-primitives` directly: its root takes them, and these styles apply the same.
- **Selectors:** `data-part` names `radio-group`, `legend`, `radio`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="radio-group" />
