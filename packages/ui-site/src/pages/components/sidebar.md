---
title: "Sidebar"
group: "Menu"
order: 40
description: "App navigation beside the page that collapses, and opens as a panel on phones."
---

# Sidebar

<p class="lead">App navigation beside the page that collapses, and opens as a panel on phones.</p>

<sidebarDemo />

## Usage

The parts come from `@clarusjs/ui-primitives`; the look is `sidebar.css`, imported once.

<<< ../../registry/sidebar-demo.tscl

## API

<componentApi name="sidebar" />

## Source

Copy it into `src/components/ui/` as `sidebar.css`. It's the same as `@clarusjs/ui`'s rules for these parts, so using both looks the same. Or the Tailwind version (switch below): the same look in Tailwind utilities, `sidebar.tw.css`, imported where Tailwind runs.

<sourceFlavor name="sidebar">

<<< ../../registry/sidebar.css

<<< ../../registry/sidebar.tw.css

</sourceFlavor>

## Styling

- **On the parts:** `class`, `style`, `id`, `aria-*` and `data-*` written on a part's tag (from `@clarusjs/ui-primitives`) land on its root element, merged with its own.
- **Selectors:** `data-part` names `sidebar`, `sidebar-trigger`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="sidebar" />
