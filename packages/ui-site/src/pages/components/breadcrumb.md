---
title: "Breadcrumb"
group: "Menu"
order: 29
description: "Where a page sits in the site, as links back up."
---

# Breadcrumb

<p class="lead">Where a page sits in the site, as links back up.</p>

<breadcrumbDemo />

## Usage

<<< ../../registry/breadcrumb-demo.tscl

## Source

Copy it into `src/components/ui/` as `breadcrumb.tscl`.

<<< ../../registry/breadcrumb.tscl

## Styling

- **On the root:** `class`, `style`, `id`, `aria-*` and `data-*` written on the tag land on its root element; `class` and `style` merge with its own.
- **Selectors:** `data-part` names `breadcrumb`, `breadcrumb-list`, `breadcrumb-item`, `breadcrumb-page`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="breadcrumb" />
