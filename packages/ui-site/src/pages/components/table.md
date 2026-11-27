---
title: "Table"
group: "Data"
order: 12
description: "A native table that scrolls sideways on small screens."
---

# Table

<p class="lead">A native table that scrolls sideways on small screens.</p>

<tableDemo />

## Usage

<<< ../../registry/table-demo.tscl

## API

<componentApi name="table" />

## Source

Copy it into `src/components/ui/` as `table.tscl`: in plain CSS, or in Tailwind classes (switch below; the Tailwind version needs `tailwind.css`).

<sourceFlavor name="table">

<<< ../../registry/table.tscl

<<< ../../registry/table.tw.tscl

</sourceFlavor>

## Styling

- **On the root:** `class`, `style`, `id`, `aria-*` and `data-*` written on the tag land on its root element; `class` and `style` merge with its own.
- **Inner pieces:** `parts` takes an object of attributes (`class`, `style`, `data-*`) for each of `table`, spread on that piece: `[parts]="{ table: { class: 'my-table' } }"`.
- **Selectors:** `data-part` names `table-scroll`, `table`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="table" />
