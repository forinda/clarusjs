---
title: "Ship it"
description: "Build the static site, check what it ships, and put it on a static host."
group: "Your first site"
order: 6
layout: /src/layouts/lesson.tscl
steps: true
---

# Ship it

A clarusjs site builds to plain files: HTML for each page, plus the code of its islands. Any static host can serve them.

## Read

`vite build` renders every static page to `dist/client`. It also checks your links (a broken internal link fails the build) and writes a manifest of what each page ships.

## Build

```sh
pnpm vite build
pnpm vite preview
```

`vite preview` serves `dist/client` locally, exactly as a host would.

## Explain

See what each page ships, from the manifest the build wrote:

```sh
pnpm exec clarusjs explain
```

Without a route it lists every route with its island count and JavaScript. With one (`clarusjs explain /posts/hello`) it shows how the page was rendered, its data, each island and when it attaches, and the JavaScript and CSS it ships.

## Deploy

Upload `dist/client/` to any static host. On Netlify, for example:

```toml [netlify.toml]
[build]
  command = "pnpm install --frozen-lockfile && pnpm vite build"
  publish = "dist/client"
```

## Quiz

::: quiz What does `vite build` put in `dist/client`?
- [ ] A Node server that renders pages
- [x] HTML for each page, plus the code of its islands
- [ ] One JavaScript bundle for the whole site

Static pages are files, so any static host serves them. Routes you choose to render per request run on a server instead.
:::

## Done

That's the path: a project, templates, an island, pages with data, Markdown and the head, and a deployed site. See your XP and badges on your progress page.

In the docs: [Static build](/guide/build), [Deploying](/guide/deploy), [CLI](/reference/cli).
