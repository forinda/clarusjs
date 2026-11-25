---
title: "Alert"
group: "Messages"
order: 7
description: "A message box with a title, plain or destructive."
---

# Alert

<p class="lead">A message box with a title, plain or destructive.</p>

<alertDemo />

## Usage

<<< ../../registry/alert-demo.tscl

## Examples

### Variants

Four tones for four kinds of news.

<alertVariantsDemo />

<<< ../../registry/alert-variants-demo.tscl

### With icons and an action

An icon in the title for the eye, and what to do next under the text.

<alertIconsDemo />

<<< ../../registry/alert-icons-demo.tscl

## Source

Copy it into `src/components/ui/` as `alert.tscl`: in plain CSS, or in Tailwind classes (switch below; the Tailwind version needs `tailwind.css`).

<sourceFlavor name="alert">

<<< ../../registry/alert.tscl

<<< ../../registry/alert.tw.tscl

</sourceFlavor>

## Styling

- **On the root:** `class`, `style`, `id`, `aria-*` and `data-*` written on the tag land on its root element; `class` and `style` merge with its own.
- **Inner pieces:** `parts` takes an object of attributes (`class`, `style`, `data-*`) for each of `title`, `description`, spread on that piece: `[parts]="{ title: { class: 'my-title' } }"`.
- **Selectors:** `data-part` names `alert`, `alert-title`, `alert-description`; state attributes `data-variant`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="alert" />
