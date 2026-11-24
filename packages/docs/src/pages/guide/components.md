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

Or name the file in kebab-case and use it [without importing it](#automatic-imports). One tag is built in and needs no import: `<icon name="lucide:search" />` renders an inline SVG when the site builds, from any Iconify set you install, with no JavaScript. See [Icons](/guide/icons).

## Automatic imports

Components in `src/components/` and `src/layouts/` can be used by name, without `@import`. The name comes from the file's path, so name files in kebab-case:

| File | Tags |
|---|---|
| `src/components/user-card.tscl` | `<user-card>` |
| `src/components/forms/text-field.tscl` | `<forms-text-field>`, and `<text-field>` |
| `src/layouts/site-shell.tscl` | `<site-shell>` |

```tscl
<user-card [user]="user" />
<text-field [label]="'Email'" />
```

- **The full name** is the folders and the file joined with hyphens: always there. **The short name** is the file alone, when no other component has it. When two do (`forms/date-field` and `admin/date-field`), `<date-field>` is an error naming both: write the full name.
- **Only names with a hyphen**, as for custom elements, so a component never takes an HTML element's name. `src/components/card.tscl` is `<card>` to nobody: import it, or move it into a folder.
- **Only what a template uses is imported**, exactly as if you had written the `@import`: nothing else is shipped.
- **An explicit `@import` still works**, with any name (`<userCard>`), and wins for its own name.
- **A web component** (`<my-widget>` registered in the browser) is left alone when no file has its name. When one does, the component wins.
- A file whose name isn't kebab-case (`TextArea.tscl`) isn't named: the build warns about it.

`clarusjs check` and the editor know the same names: they check the inputs, complete the tags and go to the file. To change the folders, or turn this off:

```ts
clarusjs({ components: { dirs: ['src/components', 'src/layouts', 'src/ui'], auto: true } })
```

This site's [Slots demo](/guide/slots#slots-that-pass-data) uses `<item-list>` this way; most of its pages still import components by name, which works the same.

## Attributes on a component

Attributes you write on a component's tag land on its root element: an `id` to link to it, `aria-*` to label it, `data-*` for tests or styling hooks.

```tscl
{{-- components/item-list.tscl: its root is a <ul> --}}
@input items: string[]
<ul>@for (item of items; track item) { <li>{{ item }}</li> }</ul>

{{-- a page --}}
<item-list [items]="steps" id="steps" aria-label="Steps" data-test="steps" />
{{-- <ul id="steps" aria-label="Steps" data-test="steps">… --}}
```

- **Which names:** `id`, `role`, `tabindex`, `hidden`, `lang`, `dir`, `style`, and any `data-*` or `aria-*`, written as is or bound (`[aria-controls]="panelId"`). Other names are inputs, and `clarusjs check` reports one the component doesn't declare. `class` is passed too, and [merges](/guide/styles) with the component's own.
- **The component's own attribute wins.** Except `style`, which is added after a written `style`, and ARIA id lists (`aria-describedby`, `aria-labelledby`, `aria-controls`, `aria-owns`), which are joined: both ids are kept.
- **A declared input is never an attribute:** a component with `@input id: string` gets `id` as its input.
- **One root:** they land when the component has a single top-level element (or component, which passes them on), or one `@if` … `@else` whose branches each hold one element (outside islands): the branch that renders gets them. A component renders one root: `clarusjs check` warns about one with several top-level elements (the `one-root` rule; an error in a later release), since there is no root to choose.
- **Server HTML only:** they ship no JavaScript. In an island they're in the first HTML; an island whose root has its own `[...]` spread, or is a component, takes none yet.

### Several elements without a wrapper: `<fragment>` {since=0.16.0}

`<fragment>` groups elements without rendering one: only its children reach the page. Use it anywhere: as a component's root, in an `@if` branch, a `@for` row, or a slot.

```tscl
{{-- components/term.tscl: a <dt> and its <dd>, for a <dl> --}}
@input word: string
<fragment>
  <dt>{{ word }}</dt>
  <dd><slot /></dd>
</fragment>
```

A fragment takes no attributes, and a component whose root is one takes none from its parent either (no `class`, `id` or `(click)`): there is no element for them to land on, and `clarusjs check` reports each one.

### A component that stands for an element: `@extends` {since=0.16.0}

`@extends input` makes a component take every attribute an `<input>` takes (`name`, `placeholder`, `required`, `disabled`, `autocomplete`…), typed by `clarusjs check`, and puts them on its root. You declare only what the component adds.

```tscl
{{-- components/text-field.tscl --}}
@extends input
@input type: string = 'text'
<input [type]="type" class="field" />

{{-- a page --}}
<text-field name="email" type="email" required placeholder="you@example.com" />
```

- **The root is that element:** one `<input>` here (or, in a stateless component, with no `<script>` and no `@model`, an `@if` … `@else` of one each). Anything else is a build error.
- **Elements:** `button`, `input`, `textarea`, `select`, `option`, `a`, `img`, `form`, `label`, `details`, `dialog`, plus the attributes every element takes (`title`, `autofocus`, `popover`…).
- **The rules above still hold:** the root's own attribute wins (`type` here), and a declared input is never an attribute.

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
