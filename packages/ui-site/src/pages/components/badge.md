---
title: "Badge"
group: "Misc"
order: 6
description: "A short label, in four variants."
---

# Badge

<p class="lead">A short label, in four variants.</p>

<badgeDemo />

## Usage

<<< ../../registry/badge-demo.tscl

## Examples

### Variants

Six variants: a status in a word.

<badgeVariantsDemo />

<<< ../../registry/badge-variants-demo.tscl

### With icons

An icon before the word makes a status scan faster; the word still says it.

<badgeIconsDemo />

<<< ../../registry/badge-icons-demo.tscl

### Counts

A count in a button: its name says what's counted, for screen readers; past 99, 99+.

<badgeCountsDemo />

<<< ../../registry/badge-counts-demo.tscl

## API

<componentApi name="badge" />

## Source

Copy it into `src/components/ui/` as `badge.tscl`: in plain CSS, or in Tailwind classes (switch below; the Tailwind version needs `tailwind.css`).

<sourceFlavor name="badge">

<<< ../../registry/badge.tscl

<<< ../../registry/badge.tw.tscl

</sourceFlavor>

## Styling

- **On the root:** `class`, `style`, `id`, `aria-*` and `data-*` written on the tag land on its root element; `class` and `style` merge with its own.
- **Selectors:** `data-part` names `badge`; state attributes `data-variant`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="badge" />
