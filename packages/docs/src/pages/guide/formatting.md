---
title: "Formatting"
group: "Tooling"
order: 3
description: "Format .tscl components with Prettier and @clarusjs/prettier-plugin: templates, <script> and <style>, from the command line and in your editor."
---

# Formatting

<p class="lead"><code>@clarusjs/prettier-plugin</code> formats <code>.tscl</code> components with Prettier: the template is indented like any HTML, <code>&lt;script&gt;</code> is formatted as JavaScript and <code>&lt;style&gt;</code> as CSS, all with your project's Prettier options.</p>

## Set up

Install Prettier and the plugin:

<pm [commands]="['add -D prettier @clarusjs/prettier-plugin']" />

Add the plugin to your Prettier config:

```json
// .prettierrc
{
  "plugins": ["@clarusjs/prettier-plugin"]
}
```

Then format as usual:

```sh
npx prettier --write "src/**/*.tscl"
npx prettier --check "src/**/*.tscl"   # in CI: fails if a file isn't formatted
```

## What it changes

- **The template:** elements are indented one level per nesting, as are the contents of `@if`, `@else`, `@for`, `@empty` and `@slot` blocks. Long tags are broken one attribute per line. Expressions in `{{ }}`, `[prop]` and `(event)` are formatted as JavaScript.
- **`<script>` and `<style>`:** formatted by Prettier's JavaScript and CSS formatters, with your options (`semi`, `singleQuote`, `printWidth` and the rest).
- **Left as written:** directives (`@import`, `@input`, `@model`, `@type`, `@interface`), `{{-- --}}` comments, the contents of `verbatim` elements, and a block where putting it on lines of its own would add a space on the page: in a sentence (`Hello @if (x) {<b>world</b>}!`), in an `<a>` or `<span>`, or holding inline pieces like `<code>` and `<span>`. Blocks among block-level elements (`<li>`, `<div>`, `<p>`, table rows) are laid out. A directive written further down the file moves to the top.
- **Files the compiler rejects** aren't formatted: Prettier reports the compiler's error instead.

For example, this:

```tscl
@input title: string
<script>
let open=state(false)
</script>
<section>@if (open) {<p>{{ title }}</p>} @else {<p>Closed</p>}</section>
```

becomes:

```tscl
@input title: string

<script>
  let open = state(false);
</script>
<section>
  @if (open) {
    <p>{{ title }}</p>
  } @else {
    <p>Closed</p>
  }
</section>
```

The indentation reaches your HTML, since whitespace inside elements is kept: on this site, formatting made pages 11% bigger, but only 2% gzipped.

Whitespace is kept where it shows on the page: `<b>a</b> <i>b</i>` keeps its space, and `<b>a</b><i>b</i>` stays without one.

## In your editor

With the [language server](/guide/editor), **Format Document** (and format on save) formats `.tscl` files with your project's Prettier and the plugin, using the same config as the command line. It needs both installed in the project, and a trusted workspace, since formatting runs your project's code. Only a Prettier config inside the workspace folder is used (one in a parent folder could load plugins from outside it). If a file can't be formatted (a block isn't closed, say), nothing changes, and the reason is in the clarusjs output.

## oxfmt

[oxfmt](https://oxc.rs/docs/guide/usage/formatter) can't load third-party Prettier plugins yet (plugin support is on its roadmap). Until it can, format `.tscl` files with Prettier, and the rest of your project with oxfmt if you like:

```sh
npx oxfmt
npx prettier --write "src/**/*.tscl"
```
