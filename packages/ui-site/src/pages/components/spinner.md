---
title: "Spinner"
group: "Misc"
order: 27
description: "A turning mark that tells screen readers it is loading."
---

# Spinner

<p class="lead">A turning mark that tells screen readers it is loading.</p>

<spinnerDemo />

## Usage

<<< ../../registry/spinner-demo.tscl

## API

<componentApi name="spinner" />

## Source

Copy it into `src/components/ui/` as `spinner.tscl`: in plain CSS, or in Tailwind classes (switch below; the Tailwind version needs `tailwind.css`).

<sourceFlavor name="spinner">

<<< ../../registry/spinner.tscl

<<< ../../registry/spinner.tw.tscl

</sourceFlavor>

## Styling

- **On the root:** `class`, `style`, `id`, `aria-*` and `data-*` written on the tag land on its root element; `class` and `style` merge with its own.
- **Selectors:** `data-part` names `spinner`, `spinner-mark`, `spinner-label`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="spinner" />
