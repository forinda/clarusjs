---
title: Markdown pages
description: Write pages in Markdown with @clarusjs/content - frontmatter, a layout, components inside Markdown, and heading anchors.
---
# Markdown pages

<p class="lead">With <code>@clarusjs/content</code>, any <code>.md</code> file under <code>src/pages</code> is a page. Its Markdown becomes static HTML inside your layout, at build time.</p>

## Set up

```ts
// vite.config.ts
import clarusjs from 'clarusjs/vite'
import markdown from '@clarusjs/content'

export default defineConfig({
  plugins: [clarusjs({ sources: [markdown({ layout: '/src/layouts/docs.tscl' })] })],
})
```

The package runs only at build time: the Markdown parser never reaches the browser, and `clarusjs` itself gains no dependency.

## A page

```md
---
title: Getting started
description: Install clarusjs and write your first page.
---

# Getting started

Write **Markdown** as usual.
```

`title` (or the first `#` heading) and `description` go to the layout, with the page's route as `path`. Set `layout:` in the frontmatter to use another layout, or `layout: false` for none.

## Components in Markdown

Import components at the top, then use them like HTML. Leave blank lines around Markdown inside a component:

```md
@import callout from '../components/callout.tscl'

<callout [type]="'tip'">

Markdown **inside** a component.

</callout>
```

## Headings and text

- Every heading gets an `id` and an anchor link, so `#install` links straight to it.
- Markdown is static: `{{ value }}` and `@if` in your prose are shown as written, never run as template code.

## Code

Fenced code is highlighted at build time with Shiki, in light and dark at once: the page's theme picks the colours with CSS, so no highlighter ships to the browser. `tscl` blocks are highlighted as templates.

```ts [vite.config.ts] {3}
import { defineConfig } from 'vite'
import clarusjs from 'clarusjs/vite'
export default defineConfig({ plugins: [clarusjs()] })
```

Mark lines with comments: `// [!code ++]`, `// [!code --]`, `// [!code focus]`, `// [!code highlight]`, `// [!code error]`. Add `:line-numbers` after the language for line numbers, and `{1,3-5}` to highlight lines.

```ts
const site = clarusjs() // [!code --]
const site = clarusjs({ sources: [markdown()] }) // [!code ++]
```

Group blocks as tabs with `::: code-group`; the tabs work without JavaScript:

::: code-group
```sh [pnpm]
pnpm add @clarusjs/content
```
```sh [npm]
npm install @clarusjs/content
```
:::

## Containers and alerts

`::: tip`, `::: info`, `::: warning` and `::: danger` blocks, with an optional title, and `::: details` (a native `<details>`):

```md
::: warning Before you upgrade
Read the changelog.
:::

::: details Show the long version
Hidden until opened.
:::
```

GitHub alerts work too: `> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!WARNING]` and `> [!CAUTION]`.

By default these are plain HTML (`<div class="custom-block tip">`). Pass `container: { tag, from }` to render them through your own component instead, with a custom title in its `title` slot. This site renders them as its callouts:

```ts
markdown({ container: { tag: 'callout', from: '/src/components/callout.tscl' } })
```

::: warning A title from the Markdown
This block was written as `::: warning A title from the Markdown`.
:::

> [!TIP]
> This page is written in Markdown, and this tip is a GitHub alert.

::: details What does a container compile to?
A `<callout>` with a `type`, and the title in its `title` slot. Containers nest with a longer fence (`::::` around `:::`).
:::
