---
title: "Pages and data"
description: "Dynamic routes with [param] segments, entries() to list their pages and load() for their data."
group: "Your first site"
order: 4
layout: /src/layouts/lesson.tscl
steps: true
---

# Pages and data

A page per item (a post, a user, a release) comes from one file with a `[param]` in its name, plus a loader that lists the pages and loads their data.

## Read

`src/pages/posts/[slug].tscl` matches `/posts/hello`, `/posts/templates`, and so on; the matched part arrives as the input `slug`.

Next to it, `src/pages/posts/[slug].load.ts` can export:

- `entries()`: one object per page, so a static build knows which pages to write;
- `load({ params, request })`: the page's data, which becomes its inputs.

The loader runs on the server only (at build time for static pages), so it can read files or use secrets.

## Route

```ts [src/pages/posts/[slug].load.ts]
import { posts } from '../../data/posts.ts'

export function entries() {
  return posts.map((post) => ({ slug: post.slug }))
}

export function load({ params }) {
  return { post: posts.find((post) => post.slug === params.slug) }
}
```

### The page

The page declares what `load()` returns as its inputs:

```tscl [src/pages/posts/[slug].tscl]
@import type { Post } from '../../data/posts.ts'
@input post: Post

<h1>{{ post.title }}</h1>
<p>{{ post.body }}</p>
```

## Run

Build, and each post has its own page: `dist/client/posts/hello/index.html`, and one per entry. A dynamic route without `entries()` fails the build and names the file to add.

```sh
pnpm vite build
```

Check the types too: `clarusjs check` compares what `load()` returns with the page's inputs and reports mistakes as `file.tscl:line:col`.

```sh
pnpm exec clarusjs check
```

## Quiz

::: quiz Where does `load()` run for a static page?
- [ ] In the browser, when the page opens
- [x] On the server, once per page at build time
- [ ] Both, to stay in sync

`load()` never runs in the browser. Only what the page renders reaches it, so keep secrets out of island props, which are written into the page.
:::

## Done

You have a page per item, with its data loaded at build time. Next: writing pages in Markdown, and what goes in the head.

In the docs: [Pages and routes](/guide/routing), [Rendering modes](/guide/rendering-modes), [Type checking](/guide/type-checking).
