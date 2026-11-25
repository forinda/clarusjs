---
title: "Alert dialog"
group: "Components"
order: 37
description: "A dialog that asks before something can't be undone."
---

# Alert dialog

<p class="lead">A dialog that asks before something can't be undone.</p>

<alertDialogDemo />

## Usage

<<< ../../registry/alert-dialog-demo.tscl

## Source

Copy it into `src/components/ui/` as `alert-dialog.tscl`.

<<< ../../registry/alert-dialog.tscl

## Styling

- **On the root:** `class`, `style`, `id`, `aria-*` and `data-*` written on the tag land on its root element; `class` and `style` merge with its own.
- **Selectors:** `data-part` names `alert-dialog-description`, `alert-dialog-actions`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="alert-dialog" />
