---
title: "Empty"
group: "Components"
order: 32
description: "What to show when there is nothing yet, with a way to start."
---

# Empty

<p class="lead">What to show when there is nothing yet, with a way to start.</p>

<emptyDemo />

## Usage

<<< ../../registry/empty-demo.tscl

## Source

Copy it into `src/components/ui/` as `empty.tscl`.

<<< ../../registry/empty.tscl

## Styling

- **On the root:** `class`, `style`, `id`, `aria-*` and `data-*` written on the tag land on its root element; `class` and `style` merge with its own.
- **Selectors:** `data-part` names `empty`, `empty-icon`, `empty-title`, `empty-description`, `empty-action`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="empty" />
