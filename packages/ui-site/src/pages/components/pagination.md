---
title: "Pagination"
group: "Components"
order: 30
description: "Links to the pages of a long list, shortened with ellipses."
---

# Pagination

<p class="lead">Links to the pages of a long list, shortened with ellipses.</p>

<paginationDemo />

## Usage

<<< ../../registry/pagination-demo.tscl

## Source

Copy it into `src/components/ui/` as `pagination.tscl`.

<<< ../../registry/pagination.tscl

## Styling

- **On the root:** `class`, `style`, `id`, `aria-*` and `data-*` written on the tag land on its root element; `class` and `style` merge with its own.
- **Selectors:** `data-part` names `pagination`, `pagination-list`, `pagination-prev`, `pagination-ellipsis`, `pagination-current`, `pagination-link`, `pagination-next`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="pagination" />
