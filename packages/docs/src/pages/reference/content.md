---
title: "@clarusjs/content"
group: "APIs"
order: 6
description: "markdown() and slugify(): Markdown pages as a page source, with every option, caveats and usage."
---

# @clarusjs/content

<p class="lead">Markdown pages as a page source. For the how-to, see <a href="/guide/markdown">Markdown pages</a>.</p>

```ts
import markdown, { slugify } from '@clarusjs/content'
```

## markdown()

```ts
markdown(options?: MarkdownOptions): Source
```

Turns `src/pages/**/*.md` into pages, rendered in your layout. They get:

- frontmatter;
- headings with anchors;
- highlighted code;
- `::: tip` blocks and alerts;
- components imported at the top;
- quizzes, in lessons.

It runs at build time only: nothing of it reaches the browser.

### Parameters

- **`options`** (optional):
  - **`layout`**: the layout every page renders in, root-relative (`'/src/layouts/docs.tscl'`). A page's frontmatter `layout` overrides it; `false` means none.
  - **`container`** (`{ tag, from }`): render `::: tip` blocks and alerts through your own component, as `<tag [type]="'tip'">`, with a custom title in its `title` slot. Without it they're plain HTML.
  - **`titles`**: block titles, to translate them (`{ tip: 'Astuce', note: 'Remarque' }`).
  - **`copy`** (`{ tag, from }`): put your copy component in every code block.
  - **`quiz`** (`{ tag, from }`): render `::: quiz` blocks through your quiz component (an island). Without it they're static HTML that works without JavaScript.
  - **`quizzes`** (default `'lessons'`): `::: quiz` is for lessons (frontmatter `steps: true`); `'everywhere'` allows it on any page.
  - **`schema`**: validate each page's frontmatter, with one [Standard Schema](https://standardschema.dev) or one per folder (`{ 'guide/**': Guide, 'blog/*.md': Post }`, where the first matching glob wins).

### Returns

A page source (see [Page sources](/reference/vite-plugin#page-sources)), for the plugin's `sources` option.

### Caveats

- **A page that fails its schema fails the build,** naming the file and each problem. The schema's output, with its defaults and coercions, is what the page gets.
- **Schemas must be synchronous,** as most are.

### Usage

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import clarusjs from 'clarusjs/vite'
import markdown from '@clarusjs/content'

export default defineConfig({
  plugins: [clarusjs({ sources: [markdown({ layout: '/src/layouts/docs.tscl' })] })],
})
```

## slugify()

```ts
slugify(text: string): string
```

A heading's anchor: lowercase, accents and punctuation removed, words joined by `-`. It's what headings' ids are made of, so a link to a section can be built from its title.

```ts
slugify('Getting started!') // 'getting-started'
```
