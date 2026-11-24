---
title: "Styles"
group: "Templates"
order: 10
description: "Give components their own CSS with <style scoped>, scoped with native @scope, write global CSS, and import stylesheets that go through Vite."
---


# Styles

<p class="lead">A component can bring its own CSS in a <code>&lt;style scoped&gt;</code> block. Its rules reach the component's own elements and stop at the rest of the page.</p>

```tscl
{{-- components/card.tscl --}}
<section class="card">
  <h2><slot name="title" /></h2>
  <slot />
</section>

<style scoped>
  :scope { border: 1px solid var(--rule); border-radius: 8px; }
  h2 { margin-top: 0; }
</style>
```

## How scoping works

clarusjs uses the browser's own `@scope`. Every component's top-level elements carry a class unique to it, like `cl-c-card-1a2b`, merged with their own `class`. A `<style scoped>` block applies inside those elements.

- **`:scope` is the component's own top-level element.** It's CSS, not clarusjs syntax: a rule like `section {}` matches elements *inside* the component, not the top-level one.
- **Slot content** sits inside the component, so the component's rules apply to it too.
- **A child component's top-level element is styled by its parent; its inside isn't.** This is Vue's rule. A parent can give a child component a margin or a border through the child's own class, but can't reach the elements inside it, whether or not the child has a `<style>`.

```tscl
@import card from './card.tscl'

<div class="list">
  <p>Teal.</p>
  <card />
</div>

<style scoped>
  p { color: teal; }                   /* the parent's own <p>, not any inside the card */
  .card { margin-block: 1rem; }        /* the card's top-level element: its class is "card" */
</style>
```

Pass a class to a component with `class="…"` on its tag: it lands on the component's top-level elements, after their own, so the parent's rules can use it.

```tscl
<card class="featured" />

<style scoped>
  .featured { border-color: gold; }
</style>
```

Only a static `class` passes through; `[class]` and `{{ }}` in it aren't supported on a component yet.

Rendering only `<card />` and writing `:scope {}` styles nothing: `:scope` is the parent's own top-level element, and a component on its own has none.

<scopeDemo />

The `cl-c-` class prefix is reserved for these marks.

### A page inside its layout

A page usually wraps its content in a layout (`<docs>…</docs>`). That content is still the page's: when the page has a `<style scoped>`, the top-level elements it passes to the layout (to its default slot and to `@slot('name')`) carry the page's class too, so the page's rules reach them. This site's home page styles its bento grid that way. Without a `<style scoped>`, no class is added.

## Global styles

A `<style>` without `scoped` is plain CSS for the whole page, such as custom properties for the site. Write `<style global>` to say so.

```tscl
<style global>
  :root { --accent: #0b6e70; }
</style>
```

::: warning
A plain `<style>` used to be scoped. It is global now, and the compiler warns about one, with its place. Add `scoped` to keep it scoped to its component, or `global` to keep it global without the warning.
:::

## Values from the template

A `<style>` block is plain CSS: `{{ }}` holes aren't allowed in it. Pass values as CSS custom properties instead.

```tscl
<div class="bar" style="--width: {{ percent }}%"></div>

<style scoped>
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
