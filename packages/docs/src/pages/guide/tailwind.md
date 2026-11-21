---
title: Tailwind CSS
description: Use Tailwind CSS v4 in a clarusjs app with its official Vite plugin, including @apply in scoped component styles.
---

# Tailwind CSS

<p class="lead">Tailwind CSS v4 works through its official Vite plugin. clarusjs needs no extra setup: utilities in templates, Markdown pages and islands are all found.</p>

## Set up

::: code-group

```sh [pnpm]
pnpm add -D tailwindcss @tailwindcss/vite
```

```sh [npm]
npm install -D tailwindcss @tailwindcss/vite
```

:::

Add the plugin next to clarusjs:

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import clarusjs from 'clarusjs/vite'

export default defineConfig({ plugins: [tailwindcss(), clarusjs()] })
```

Create a stylesheet and import it in your layout, like any [stylesheet](./styles.md). Every page that uses the layout links it:

```css
/* src/styles/app.css */
@import "tailwindcss";
```

```tscl
{{-- src/layouts/main.tscl --}}
@import '../styles/app.css'

<html lang="en">
  <head><title>{{ title }}</title></head>
  <body class="bg-slate-50 text-slate-900"><slot /></body>
</html>
```

## Use utilities

Write classes in templates as usual. Tailwind scans every file in your project, including `.tscl` components and Markdown pages, so classes used only inside an island's `@if` branch or a `[class]` binding are generated too:

```tscl
<button [class]="on ? 'bg-emerald-500 text-white' : 'bg-zinc-200'" (click)="on = !on">Toggle</button>
```

Keep each class name whole in the source. Tailwind reads the text of your files, so a name built at runtime (`'bg-' + color + '-500'`) is never generated.

## @apply in component styles

A component's scoped `<style>` can use `@apply` and theme functions. Start it with `@reference` to your stylesheet, so Tailwind knows your theme without copying its CSS into the component:

```tscl
<section class="card"><slot /></section>

<style>
  @reference "../styles/app.css";
  :scope { @apply rounded-lg p-6 shadow-md; }
</style>
```

`@reference` and `@import` lines at the top of a `<style>` are kept outside the component's `@scope` block, and their paths stay relative to the component file.
