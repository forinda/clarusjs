---
title: "Components"
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

## Components from packages

Import a component from a package by its path, as you would any module. It can be interactive, have scoped styles, and import other components:

```tscl
@import layout from '@acme/docs-theme/layout.tscl'

<layout [title]="'Home'"><h1>Hello</h1></layout>
```

clarusjs follows `@import` lines from `src/` into packages, so a package's islands get their own chunk and its styles join yours, in development and in builds. A package shares components by shipping its `.tscl` files (export them in `package.json`, for example `"exports": { "./*": "./src/*" }`).
