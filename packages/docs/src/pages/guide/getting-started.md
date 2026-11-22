---
title: "Getting started"
group: "Introduction"
order: 2
description: "Install clarusjs, configure Vite and write your first page."
---

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

## TypeScript or JavaScript

Both work: island scripts are JavaScript either way, and `@input` types are checked by `clarusjs check` (see [Type checking](./type-checking.md)). The config is for your editor and the checker.

::: code-group
```json [tsconfig.json]
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "skipLibCheck": true,
    "paths": { "~/*": ["./src/*"] }
  },
  "include": ["src", ".clarusjs/views.d.ts", ".clarusjs/routes.d.ts"]
}
```
```json [jsconfig.json]
{
  "compilerOptions": {
    "checkJs": true,
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "paths": { "~/*": ["./src/*"] }
  },
  "include": ["src", ".clarusjs/views.d.ts", ".clarusjs/routes.d.ts"]
}
```
:::

- **`moduleResolution: "Bundler"`** resolves imports the way Vite does, including `clarusjs/navigation` and the other entry points.
- **`allowImportingTsExtensions`** lets a page or component import `../data.ts` with its extension, as Vite allows. A JavaScript project imports `.js` files and doesn't need it.
- **`.clarusjs/`** holds the types `clarusjs check` writes: `views.d.ts` (for [`render()`](/reference/runtime)) and `routes.d.ts` (for [`href()`](./navigation.md#typed-routes)). Including them gives your editor the same errors as the checker. Run `clarusjs check` once to create them, and add the folder to `.gitignore`:

```sh
# .gitignore
.clarusjs/
```

### Path aliases

`~/` is `src/`, built in: `@import card from '~/components/card.tscl'` works from any folder, in templates, island scripts and `.load.ts` files. Other aliases come from your config's `paths` (like `"@/*": ["./src/*"]`) and from Vite's `resolve.alias`; dev, build and `clarusjs check` resolve them the same way. The `paths` entry for `~/*` above is for your editor and plain `tsc`, which don't know the built-in one. An import that no file, package or alias matches is an error at its `@import`.

In JavaScript, `checkJs` turns on type errors in `.js` files, from JSDoc types and the generated ones; leave it out for hints without errors. `clarusjs check` reads either file.

## Run it

<pm [commands]="['exec vite        # dev server, pages rendered on each request', 'exec vite build  # static site in dist/client/']" />
