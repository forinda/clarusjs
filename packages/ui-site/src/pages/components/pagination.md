---
title: "Pagination"
group: "Data"
order: 30
description: "Links to the pages of a long list, shortened with ellipses."
---

# Pagination

<p class="lead">Links to the pages of a long list, shortened with ellipses.</p>

<paginationDemo />

## Usage

Plain links, no JavaScript: `href` is a pattern with `{page}` (`/posts?page={page}`), and your server renders the page asked for, with `page` and `pages` from your data. This page is static, so the demo's links stay on it (`#page-2`).

<<< ../../registry/pagination-demo.tscl

## API

<componentApi name="pagination" />

## Source

Copy it into `src/components/ui/` as `pagination.tscl`: in plain CSS, or in Tailwind classes (switch below; the Tailwind version needs `tailwind.css`).

<sourceFlavor name="pagination">

<<< ../../registry/pagination.tscl

<<< ../../registry/pagination.tw.tscl

</sourceFlavor>

## Styling

- **On the root:** `class`, `style`, `id`, `aria-*` and `data-*` written on the tag land on its root element; `class` and `style` merge with its own.
- **Selectors:** `data-part` names `pagination`, `pagination-list`, `pagination-prev`, `pagination-ellipsis`, `pagination-current`, `pagination-link`, `pagination-next`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="pagination" />
