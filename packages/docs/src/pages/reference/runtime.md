---
title: "Runtime"
group: "APIs"
order: 1
description: "state, derived and shared: the functions you use in island scripts and stores."
---

# Runtime

## state(initial)

A reactive value. In an island's script, read and write it as a plain variable. In a `.ts` module, use `.get()` and `.set(value)`.

```ts
import { state } from 'clarusjs/runtime'

const count = state(0)   // { get(), set(v), initial }
```

## derived(fn)

A value computed from other state; it updates when they change. Read-only.

## shared(store)

In an island's script, a local name for a store (a module-level `state()`). Reads and writes go to the store, so every island using it stays in sync. On the server it renders a copy of the store's initial value.

## render(name, props)

From `clarusjs/views`, in server code (a `load()`, a script importing the built server): renders any view under `src/` to an HTML string. The name is its path without the extension.

```ts
import { render } from 'clarusjs/views'

const html = await render('components/pill', { text: 'new' })
```

Props are typed against the view's inputs by `.clarusjs/views.d.ts`, which `clarusjs check` writes: an unknown name or a wrong prop is a type error. Add that file to your `tsconfig.json`'s `include` to get the same types in your editor. The built server, `dist/server/index.mjs`, exports `render` too.
