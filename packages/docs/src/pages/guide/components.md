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

Import values a template needs with `@import { … } from '…'`, or `@import data from './data.json'`. In a component without a script the import only runs on the server, so it can even read files at build time; in an interactive component it is sent to the browser with the component's code.

```tscl
@import { posts } from '../data/posts.ts'

<ul>
  @for (post of posts; track post.slug) { <li>{{ post.title }}</li> }
</ul>
```

::: tip
Mistakes are build errors with a location, for example `components.tscl:3:9 unclosed <span>`.
:::
