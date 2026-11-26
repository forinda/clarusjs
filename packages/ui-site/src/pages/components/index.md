---
title: "Introduction"
group: "Get started"
order: 1
description: "Styled clarusjs components you copy into your project and make your own."
---

# clarusjs ui

<p class="lead">Styled components for clarusjs. Copy a component's file into your project: it's yours to change. Nothing to install but <code>@clarusjs/ui-primitives</code>, for the parts that need behaviour. They're built on native HTML (<code>&lt;dialog&gt;</code>, popover, <code>&lt;details&gt;</code>, real form inputs), so the browser does the hard parts.</p>

<introShowcase />

## 1. Copy the theme

Every component styles itself with the `--ui-` tokens: colours, radius, spacing and fonts, light and dark. Save `theme.css` once, link it on every page (or `@import` it from your layout), and change the values to change the look, or make your own with the theme builder (**Theme**, top right).

::: details Show theme.css
<<< ../../theme.css
:::

## 2. Copy a component

Pick one below or in the sidebar. Its page shows it working, how to use it, and its file to copy. Components with behaviour (a dialog, tabs) build on `@clarusjs/ui-primitives`:

```sh
pnpm add @clarusjs/ui-primitives
```

<componentList />

## Using Tailwind CSS

The components work as they are with Tailwind (v4). To use your theme in Tailwind's classes too (`bg-primary`, `text-muted-foreground`, `border-input`, `rounded-lg`), save `tailwind.css` and import it after `theme.css`. Classes you pass to a component, on its tag or in `parts`, override its own rules: those sit in `@layer components`, below Tailwind's utilities.

::: details Show tailwind.css
<<< ../../tailwind.css
:::

