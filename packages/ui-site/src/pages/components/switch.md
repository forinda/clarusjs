---
title: "Switch"
group: "Form"
order: 15
description: "An on/off switch on a native checkbox."
---

# Switch

<p class="lead">An on/off switch on a native checkbox.</p>

<switchDemo />

## Usage

<<< ../../registry/switch-demo.tscl

## Examples

### States

Off, on, and disabled either way.

<switchStatesDemo />

<<< ../../registry/switch-states-demo.tscl

### A settings list

Each switch with a line saying what it does.

<switchSettingsDemo />

<<< ../../registry/switch-settings-demo.tscl

## API

<componentApi name="switch" />

## Source

Copy it into `src/components/ui/` as `switch.tscl`. Its `<style global>` is the same as `@clarusjs/ui`'s rules for this part, so using both looks the same. Or the Tailwind version (switch below): the same look in Tailwind utilities, `switch.tw.tscl` copied as `switch.tscl` with `switch.tw.css` beside it.

<sourceFlavor name="switch">

<<< ../../registry/switch.tscl

<<< ../../registry/switch.tw.tscl

<<< ../../registry/switch.tw.css

</sourceFlavor>

## Styling

- **On the root:** this wrapper is an island around `switch.tscl` from `@clarusjs/ui-primitives`, and attributes on its tag don't reach that part yet (a framework limit). For `class`, `style`, `id`, `aria-*` or `data-*` on it, put them on a wrapping element of your own, or use `switch.tscl` from `@clarusjs/ui-primitives` directly: its root takes them, and these styles apply the same.
- **Selectors:** `data-part` names `switch`, `checkbox`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="switch" />
