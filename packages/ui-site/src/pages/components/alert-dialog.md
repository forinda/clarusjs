---
title: "Alert dialog"
group: "Overlay"
order: 37
description: "A dialog that asks before something can't be undone."
---

# Alert dialog

<p class="lead">A dialog that asks before something can't be undone.</p>

<alertDialogDemo />

## Usage

<<< ../../registry/alert-dialog-demo.tscl

## Source

Copy it into `src/components/ui/` as `alert-dialog.tscl`. Or the Tailwind version (switch below): the same look in Tailwind utilities, `alert-dialog.tw.tscl` copied as `alert-dialog.tscl` with `alert-dialog.tw.css` beside it.

<sourceFlavor name="alert-dialog">

<<< ../../registry/alert-dialog.tscl

<<< ../../registry/alert-dialog.tw.tscl

<<< ../../registry/alert-dialog.tw.css

</sourceFlavor>

## Styling

- **On the root:** `class`, `style`, `id`, `aria-*` and `data-*` written on the tag land on its root element; `class` and `style` merge with its own.
- **Selectors:** `data-part` names `alert-dialog-description`, `alert-dialog-actions`; `backdrop` (`light`, `dark`, `blur`, `none`) sets `data-backdrop` on its dialog.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="alert-dialog" />
