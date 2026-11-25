---
title: "Sidebar"
group: "Components"
order: 40
description: "App navigation beside the page that collapses, and opens as a panel on phones."
---

# Sidebar

<p class="lead">App navigation beside the page that collapses, and opens as a panel on phones.</p>

<sidebarDemo />

## Usage

The parts come from `@clarusjs/ui-primitives`; the look is `sidebar.css`, imported once.

<<< ../../registry/sidebar-demo.tscl

## Source

Copy it into `src/components/ui/` as `sidebar.css`. It's the same as `@clarusjs/ui`'s rules for these parts, so using both looks the same.

<<< ../../registry/sidebar.css

## Styling

- **On the parts:** `class`, `style`, `id`, `aria-*` and `data-*` written on a part's tag (from `@clarusjs/ui-primitives`) land on its root element, merged with its own.
- **Selectors:** `data-part` names `sidebar`, `sidebar-trigger`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="sidebar" />
