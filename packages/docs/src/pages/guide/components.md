---
title: "Components"
group: "Templates"
order: 1
description: "A clarusjs component is a .tscl file: a template, optional typed inputs and an optional script."
---

# Components

<p class="lead">A component is a <code>.tscl</code> file: a template, optional typed inputs, and an optional <code>&lt;script&gt;</code>. Without a script it is HTML only.</p>

```tscl
{{-- components/greeting.tscl --}}
@input name: string

<p>Hello, {{ name }}!</p>
```

## Using components

Import a component by name, then use it as a tag. Pass inputs with `[name]="expression"`.

```tscl
@import greeting from '../components/greeting.tscl'

<greeting [name]="'world'" />
```

## Importing data

Import values a template needs with `@import { … } from '…'`, or `@import data from './data.json'`. In a server-rendered component without a script the import only runs on the server, so it can even read files at build time. In an interactive component, or a page on a client route (rendered in the browser), it is sent to the browser with the component's code: there, read files in `load()` and return only public data.

```tscl
@import { posts } from '../data/posts.ts'

<ul>
  @for (post of posts; track post.slug) { <li>{{ post.title }}</li> }
</ul>
```

::: tip
Mistakes are build errors with a location, for example `components.tscl:3:9 unclosed <span>`.
:::

## Loading data

A component can load its own data. Put a `load()` in a `.load.ts` file next to it, and what it returns fills the component's inputs, so the page using it passes nothing:

```ts
// src/components/latest-release.load.ts
export async function load({ locals }) {
  const latest = await releases.newest()
  return { version: latest.version, changes: latest.changes.length }
}
```

```tscl
{{-- src/components/latest-release.tscl --}}
@input version: string = ''
@input changes: number = 0

<p>Latest: clarusjs {{ version }}, with {{ changes }} changes.</p>
```

The Release notes page shows this one, as `<latestRelease />`.

- **In parallel:** before a page renders, every component loader it uses runs at once, however deeply the components are nested, then the page renders with their results. A slow loader doesn't wait for another.
- **The route's context:** a loader gets the same `{ params, request, cookies, locals }` as a page's `load()` (see [LoadContext](/reference/server#loadcontext)), but not its parent's props, so loaders can't depend on each other.
- **When it runs:** like the page: once at build for a static page (no cookies there), on every request for a server route.
- **The parent's props win:** what a page passes to the component overrides what its loader returned.
- **Islands:** a component with a `<script>` gets its loaded inputs in the browser too, like any other props.
- **Not in client routes yet:** they render in the browser, where loaders don't run. Using such a component there is an error at build.

## Components from packages

Import a component from a package by its path, as you would any module. It can be interactive, have scoped styles, and import other components:

```tscl
@import layout from '@acme/docs-theme/layout.tscl'

<layout [title]="'Home'"><h1>Hello</h1></layout>
```

clarusjs follows `@import` lines from `src/` into packages, so a package's islands get their own chunk and its styles join yours, in development and in builds. A package shares components by shipping its `.tscl` files (export them in `package.json`, for example `"exports": { "./*": "./src/*" }`).
