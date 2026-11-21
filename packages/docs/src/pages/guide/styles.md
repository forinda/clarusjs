---
title: "Styles"
group: "Templates"
order: 9
description: "Give components their own CSS with a style block scoped with native @scope, and import stylesheets that go through Vite."
---

# Styles

<p class="lead">A component can bring its own CSS in a <code>&lt;style&gt;</code> block. It is scoped to the component, so its rules don't reach the rest of the page.</p>

```tscl
{{-- components/card.tscl --}}
<section class="card">
  <h2><slot name="title" /></h2>
  <slot />
</section>

<style>
  :scope { border: 1px solid var(--rule); border-radius: 8px; }
  h2 { margin-top: 0; }
</style>
```

## How scoping works

clarusjs uses the browser's own `@scope`: the component's top-level elements are marked with `data-cl-c`, and its rules apply inside them, stopping at other components.

- **The top-level element itself** is `:scope`. A rule like `section {}` matches elements *inside* the component, not the top-level one.
- **Slot content** sits inside the component, so the component's rules apply to it too.
- **Child components** are left alone: their own top-level elements stop the scope.

## Global styles

Add `global` to write CSS that isn't scoped, such as custom properties for the whole site.

```tscl
<style global>
  :root { --accent: #0b6e70; }
</style>
```

## Values from the template

A `<style>` block is plain CSS: `{{ }}` holes aren't allowed in it. Pass values as CSS custom properties instead.

```tscl
<div class="bar" style="--width: {{ percent }}%"></div>

<style>
  :scope { width: var(--width); } /* .bar is the component's top-level element: its :scope */
</style>
```

## Dark mode without a flash

A saved theme has to be on the page before it is first drawn, or visitors see the wrong colours for a moment. Put a small `<script inline>` at the top of your layout's `<head>`: it is written into the page as is and runs before anything is shown. This site does exactly that.

```tscl
<head>
  <script inline>
    try {
      const t = localStorage.getItem('theme')
      if (t) document.documentElement.setAttribute('data-theme', t)
    } catch {}
  </script>
  <link rel="stylesheet" href="/site.css">
</head>
```

Inline scripts take static attributes only and their content is never treated as a template. On client routes, the router runs the new page's inline head scripts, as a normal page load would.

## Stylesheets

Import a CSS file with `@import` and no name. It goes through Vite's CSS pipeline (PostCSS or Lightning CSS, minified and hashed), and every page that uses the component links it.

```tscl
{{-- layouts/docs.tscl --}}
@import '../styles/docs.css'
```

Each page links exactly the stylesheets it imports, directly or through its components, in import order with a layout's before the page's own. This site's whole stylesheet is imported that way, by its layout.

## How styles reach the page

A page links its imported stylesheets, then one stylesheet with every component's `<style>`. With fragment navigation, a page that needs a stylesheet the current page doesn't have gets it before the swap.

::: info
`@scope` is supported in all current major browsers. In older ones, scoped rules are ignored.
:::
