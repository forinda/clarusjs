---
title: "Introduction"
group: "Get started"
order: 1
description: "Styled clarusjs components you copy into your project and make your own."
---

# clarusjs ui

<p class="lead">Styled components for clarusjs. Copy a component's file into your project: it's yours to change. Nothing to install but <code>@clarusjs/ui-primitives</code>, for the parts that need behaviour.</p>

## 1. Copy the theme

Every component styles itself with the `--ui-` tokens. Save this as `theme.css` once, link it on every page (or `@import` it from your layout), and change the values to change the look:

<<< ../theme.css

## 2. Copy a component

Pick one below or in the sidebar. Its page shows it working, how to use it, and its file to copy. Components with behaviour (a dialog, tabs) build on `@clarusjs/ui-primitives`:

```sh
pnpm add @clarusjs/ui-primitives
```

<componentList />

## Using Tailwind CSS

The components work as they are with Tailwind (v4). To use your theme in Tailwind's classes too (`bg-primary`, `text-muted-foreground`, `border-input`, `rounded-lg`), save this as `tailwind.css` and import it after `theme.css`. Classes you pass to a component, on its tag or in `parts`, override its own rules: those sit in `@layer components`, below Tailwind's utilities.

<<< ../tailwind.css

