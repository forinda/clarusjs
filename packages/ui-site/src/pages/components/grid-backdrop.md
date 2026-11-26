---
title: "Grid backdrop"
group: "Misc"
order: 40
description: "Ruled lines behind a section, fading at the edges; no JavaScript."
---

# Grid backdrop

<p class="lead">Ruled lines behind a section, fading at the edges; no JavaScript.</p>

<gridBackdropDemo />

## Usage

<<< ../../registry/grid-backdrop-demo.tscl

## Source

Copy it into `src/components/ui/`. Its `<style global>` holds its rules: change them there to change its look.

<<< ../../registry/grid-backdrop.tscl

## Styling

- **On the root:** `class`, `style`, `id`, `aria-*` and `data-*` written on the tag land on its root element; `class` and `style` merge with its own.
- **Selectors:** `data-part` names `grid-backdrop`; state attributes `data-corner` (the "+" marks: `start`, `end`). The cell is `--ui-grid-cell` (48px).
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="grid-backdrop" />
