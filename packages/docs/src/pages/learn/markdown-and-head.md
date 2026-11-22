---
title: "Markdown and the head"
description: "Write pages in Markdown with @clarusjs/content, and set titles, descriptions and social cards."
group: "Your first site"
order: 5
layout: /src/layouts/lesson.tscl
steps: true
minutes: 5
---

# Markdown and the head

Long text is easier to write in Markdown. `@clarusjs/content` turns `.md` files in `src/pages` into pages, in your layout, and the head gets what search engines and link previews need.

## Read

Markdown pages are compiled at build time: the Markdown parser never reaches the browser. Frontmatter at the top sets the title and description, and a layout wraps every page. Components can be used inside Markdown too.

## Set up

```sh
pnpm add -D @clarusjs/content
```

```ts [vite.config.ts]
import { defineConfig } from 'vite'
import clarusjs from 'clarusjs/vite'
import markdown from '@clarusjs/content'

export default defineConfig({
  plugins: [clarusjs({ sources: [markdown({ layout: '/src/layouts/page.tscl' })] })],
})
```

## Write

```md [src/pages/about.md]
---
title: About
description: Who we are and what we build.
---

# About

We build **small, fast** sites.
```

<div class="result"><p><strong>About</strong></p><p>We build <strong>small, fast</strong> sites.</p></div>

## Head

Give the plugin your site's address and name, and every page gets a canonical URL and social cards (Open Graph and Twitter), plus a sitemap:

```ts [vite.config.ts]
clarusjs({ site: { url: 'https://example.com', name: 'Example' } })
```

A page adds its own tags with `<cl-head>`, which moves them into the `<head>`:

```tscl
<cl-head><meta name="robots" content="noindex"></cl-head>
```

## Quiz

::: quiz Does the Markdown parser ship to the browser?
- [ ] Yes, to render pages on the client
- [x] No: Markdown is compiled at build time
- [ ] Only for pages with components

`@clarusjs/content` runs only while the site builds. The browser gets HTML, plus the code of any islands the page uses.
:::

## Done

You can write pages in Markdown and control the head. Last lesson: ship the site.

In the docs: [Markdown pages](/guide/markdown), [Vite plugin](/reference/vite-plugin).
