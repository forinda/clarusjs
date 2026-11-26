---
title: "Navbar"
group: "Menu"
order: 41
description: "The bar at the top of a site: logo, links or menus, actions; on phones a Menu button opens a sheet."
---

# Navbar

<p class="lead">The bar at the top of a site: logo, links or menus, actions; on phones a Menu button opens a sheet.</p>

<navbarDemo />

## Usage

<<< ../../registry/navbar-demo.tscl

## Source

Copy it into `src/components/ui/` as `navbar.tscl`, with `sheet.css` for its phone sheet. Its `<style global>` holds its rules: change them there to change its look.

<<< ../../registry/navbar.tscl

## Styling

- **On the root:** `class`, `style`, `id`, `aria-*` and `data-*` written on the tag land on its root element; `class` and `style` merge with its own.
- **Selectors:** `data-part` names `navbar`, `navbar-logo`, `navbar-links`, `navbar-actions`, `navbar-toggle`; a `menu-trigger` in the links is styled as a link; the sheet is `sheet.css`'s, opened by `data-side`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="navbar" />
