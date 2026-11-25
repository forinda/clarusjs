---
title: "Kbd"
group: "Misc"
order: 11
description: "A key to press, as in Ctrl K."
---

# Kbd

<p class="lead">A key to press, as in Ctrl K.</p>

<kbdDemo />

## Usage

<<< ../../registry/kbd-demo.tscl

## Source

Copy it into `src/components/ui/` as `kbd.tscl`: in plain CSS, or in Tailwind classes (switch below; the Tailwind version needs `tailwind.css`).

<sourceFlavor name="kbd">

<<< ../../registry/kbd.tscl

<<< ../../registry/kbd.tw.tscl

</sourceFlavor>

## Styling

- **On the root:** `class`, `style`, `id`, `aria-*` and `data-*` written on the tag land on its root element; `class` and `style` merge with its own.
- **Selectors:** `data-part` names `kbd`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="kbd" />
