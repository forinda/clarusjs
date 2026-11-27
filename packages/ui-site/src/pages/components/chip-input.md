---
title: "Chip input"
group: "Form"
order: 25
description: "A field where each value typed becomes a chip: tags, email addresses."
---

# Chip input

<p class="lead">A field where each value typed becomes a chip: tags, email addresses.</p>

<chipInputDemo />

## Usage

The part comes from `@clarusjs/ui-primitives`; the look is `chip-input.css`, imported once. Enter or a comma adds what's typed (a pasted list too), Backspace in the empty field removes the last chip, and each chip's × removes it. Bind the list with `[(values)]`; with `[name]`, a hidden input per value sends them with a form. `(change)` comes first, with `$info.cancel()` to refuse a value (a malformed email address, say). For values picked from a list instead, use the [combobox](/components/combobox) with `[multiple]`.

<<< ../../registry/chip-input-demo.tscl

## API

<componentApi name="chip-input" />

## Source

Copy it into `src/components/ui/` as `chip-input.css`. It's the same as `@clarusjs/ui`'s rules for these parts, so using both looks the same. Or the Tailwind version (switch below): the same look in Tailwind utilities, `chip-input.tw.css`, imported where Tailwind runs.

<sourceFlavor name="chip-input">

<<< ../../registry/chip-input.css

<<< ../../registry/chip-input.tw.css

</sourceFlavor>

## Styling

- **On the parts:** `class`, `style`, `id`, `aria-*` and `data-*` written on a part's tag (from `@clarusjs/ui-primitives`) land on its root element, merged with its own.
- **Selectors:** `data-part` names `chip-input`, `label`, `control`, `chip`, `input`, `hint`, and the field rules it shares: `field`, `select`, `description`, `error`, `option`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="chip-input" />
