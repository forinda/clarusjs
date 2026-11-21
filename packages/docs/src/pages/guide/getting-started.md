---
title: "Getting started"
group: "Introduction"
order: 2
description: "Install clarusjs, configure Vite and write your first page."
---
@import pm from '../../components/pm.tscl'

# Getting started

<p class="lead">clarusjs is a Vite plugin plus a small runtime. You need Node 22.12 or later.</p>

## Install

<pm [commands]="['add clarusjs', 'add -D vite']" />

## Configure Vite

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import clarusjs from 'clarusjs/vite'

export default defineConfig({ plugins: [clarusjs()] })
```

## Write a page

Every `.tscl` file under `src/pages` is a route: `src/pages/index.tscl` is `/`, and `src/pages/guide/intro.tscl` is `/guide/intro`.

```tscl
{{-- src/pages/index.tscl --}}
<h1>Hello</h1>
<p>This page is plain HTML.</p>
```

## Run it

<pm [commands]="['exec vite        # dev server, pages rendered on each request', 'exec vite build  # static site in dist/client/']" />
