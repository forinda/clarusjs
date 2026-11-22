---
title: "Getting started"
group: "Introduction"
order: 2
description: "Create a clarusjs project with Vite (or from a Vite template), write your first page and run it."
---

# Getting started

<p class="lead">clarusjs is a Vite plugin plus a small runtime. You need Node 22.12 or later.</p>

## Create a project

Make a folder, create its `package.json`, and install clarusjs with Vite:

<pm [commands]="['sh mkdir my-site && cd my-site', 'init', 'add clarusjs', 'add -D vite']" />

In `package.json`, make the project an ES module and add the scripts you'll run:

```json [package.json]
{
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

Keep the other fields `init` wrote, and the `dependencies` the installs added.

## Configure Vite

```ts [vite.config.ts]
import { defineConfig } from 'vite'
import clarusjs from 'clarusjs/vite'

export default defineConfig({ plugins: [clarusjs()] })
```

## Write a page

Every `.tscl` file under `src/pages` is a route: `src/pages/index.tscl` is `/`, and `src/pages/guide/intro.tscl` is `/guide/intro`.

```tscl [src/pages/index.tscl]
<h1>Hello</h1>
<p>This page is plain HTML.</p>
```

That's a whole site. There's no `index.html` and no `main.ts`: pages are `.tscl` files, and clarusjs adds the scripts a page needs.

```text
my-site/
├── package.json
├── vite.config.ts
└── src/
    └── pages/
        └── index.tscl
```

## Run it

<pm [commands]="['run dev      # dev server at http://localhost:5173, pages rendered on each request', 'run build    # the static site, in dist/client/', 'run preview  # serve the build to check it']" />

While the dev server runs, saving a file updates the open page: an island is swapped in place and keeps its state, anything else reloads the page (see [Islands](/guide/islands#editing-an-island)).

Next: [project structure](/guide/project-structure) for where components, styles and data go, or the [Learn path](/learn/first-page) to build a site step by step.

## From a Vite template

Started with `create vite`? Pick the **Vanilla** template (TypeScript or JavaScript), then add clarusjs to it:

<pm [commands]="['create vite my-site    # choose Vanilla', 'sh cd my-site', 'add clarusjs']" />

1. Add `vite.config.ts` with the plugin, as above.
2. Delete `index.html` and the template's `src/` files (`main.ts`, `counter.ts`, `style.css` and the images): clarusjs doesn't use them, and `src/pages/index.tscl` takes over `/`.
3. Write your first page in `src/pages/index.tscl`.

The template's `package.json` already has the `dev`, `build` and `preview` scripts.

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
