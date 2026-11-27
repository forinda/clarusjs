---
title: "Tabs"
group: "Panel"
order: 22
description: "Tabs over panels you write: arrow keys, Home and End, ARIA from the server."
---

# Tabs

<p class="lead">Tabs over panels you write: arrow keys, Home and End, ARIA from the server.</p>

<tabsDemo />

## Usage

The parts come from `@clarusjs/ui-primitives`; the look is `tabs.css`, imported once.

<<< ../../registry/tabs-demo.tscl

## API

<componentApi name="tabs" />

## Source

Copy it into `src/components/ui/` as `tabs.css`. It's the same as `@clarusjs/ui`'s rules for these parts, so using both looks the same. Or the Tailwind version (switch below): the same look in Tailwind utilities, `tabs.tw.css`, imported where Tailwind runs.

<sourceFlavor name="tabs">

<<< ../../registry/tabs.css

<<< ../../registry/tabs.tw.css

</sourceFlavor>

## Styling

- **On the parts:** `class`, `style`, `id`, `aria-*` and `data-*` written on a part's tag (from `@clarusjs/ui-primitives`) land on its root element, merged with its own.
- **Selectors:** `data-part` names `tabs`, `list`, `tab`, `panel`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="tabs" />
