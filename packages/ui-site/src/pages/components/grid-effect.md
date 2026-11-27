---
title: "Grid effect"
group: "Misc"
order: 41
description: "Grid lines that react to a pointer or finger: a spotlight, a trail or a lean."
---

# Grid effect

<p class="lead">Grid lines that react to a pointer or finger: a spotlight, a trail or a lean.</p>

<gridEffectDemo />

## Usage

<<< ../../registry/grid-effect-demo.tscl

## API

<componentApi name="grid-effect" />

## Source

Copy it into `src/components/ui/`. Its `<style global>` holds its rules: change them there to change its look.

<<< ../../registry/grid-effect.tscl

<<< ../../registry/grid-effect.ts

## Styling

- **On the root:** `class`, `style`, `id`, `aria-*` and `data-*` written on the tag land on its root element; `class` and `style` merge with its own.
- **Selectors:** `data-part` names `grid-effect`; state attributes `data-effect` (its effect), `data-active` (a pointer is over its section).
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="grid-effect" />
