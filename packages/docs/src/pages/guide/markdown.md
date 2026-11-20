---
title: Markdown pages
description: Write pages in Markdown with @clarusjs/content - frontmatter, a layout, components inside Markdown, and heading anchors.
---
@import callout from '../../components/callout.tscl'

# Markdown pages

<p class="lead">With <code>@clarusjs/content</code>, any <code>.md</code> file under <code>src/pages</code> is a page. Its Markdown becomes static HTML inside your layout, at build time.</p>

## Set up

```ts
// vite.config.ts
import { defineConfig } from 'vite'
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

<callout [type]="'tip'">

This page is written in Markdown.

</callout>
