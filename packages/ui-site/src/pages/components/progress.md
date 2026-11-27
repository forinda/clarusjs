---
title: "Progress"
group: "Misc"
order: 25
description: "A native progress bar; without a value, it shows work in progress."
---

# Progress

<p class="lead">A native progress bar; without a value, it shows work in progress.</p>

<progressDemo />

## Usage

<<< ../../registry/progress-demo.tscl

## API

<componentApi name="progress" />

## Source

Copy it into `src/components/ui/` as `progress.tscl`: in plain CSS, or in Tailwind classes (switch below; the Tailwind version needs `tailwind.css`).

<sourceFlavor name="progress">

<<< ../../registry/progress.tscl

<<< ../../registry/progress.tw.tscl

</sourceFlavor>

## Styling

- **On the root:** `class`, `style`, `id`, `aria-*` and `data-*` written on the tag land on its root element; `class` and `style` merge with its own.
- **Selectors:** `data-part` names `progress`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="progress" />
