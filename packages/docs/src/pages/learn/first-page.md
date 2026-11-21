---
title: "Install and a first page"
description: "Create a clarusjs project, run it, and write your first page."
group: "Your first site"
order: 1
layout: /src/layouts/lesson.tscl
steps: true
---

# Install and a first page

In this lesson you create a project, start the dev server, and change the page it serves. About five minutes.

## Read

A clarusjs site is a Vite project. Pages are `.tscl` files in `src/pages`: their path is their URL, so `src/pages/index.tscl` is `/` and `src/pages/about.tscl` is `/about`.

A page is HTML with holes for values. It becomes static HTML when the site is built, and only the parts you make interactive ship JavaScript.

## Create

Create a project and install it:

```sh
pnpm create vite my-site --template vanilla-ts
cd my-site
pnpm add -D clarusjs
```

Add the plugin to `vite.config.ts`:

```ts [vite.config.ts]
import { defineConfig } from 'vite'
import clarusjs from 'clarusjs/vite'

export default defineConfig({ plugins: [clarusjs()] })
```

## Write

Create `src/pages/index.tscl` with a heading and a value in a hole:

```tscl [src/pages/index.tscl]
<h1>Hello</h1>
<p>Built in {{ new Date().getFullYear() }}.</p>
```

<div class="result">
  <p><strong>Hello</strong></p>
  <p>Built in 2026.</p>
</div>

## Run

Start the dev server and open the address it prints:

```sh
pnpm vite
```

Change the heading and save: the page updates. Then build the static site with `pnpm vite build`; the page is in `dist/client/index.html`.

## Done

You have a project, a page, and a build. Next: templates, with inputs, lists and conditions. The [Getting started](/guide/getting-started) guide covers the same ground as a reference.
