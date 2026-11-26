---
title: "CLI"
group: "APIs"
order: 3
description: "The clarusjs command line: check and explain."
---

# CLI

## clarusjs check

Type-checks every `.tscl` file under `src/`, and the TypeScript they use, with your project's TypeScript. Errors are reported at `file.tscl:line:col`.

```sh
clarusjs check [dir] [--json]
```

| Option | Meaning |
|---|---|
| `dir` | project folder (default: the current folder) |
| `--json` | print diagnostics as JSON: file, line, column, code, message |

Exits with 1 when there are errors. See [Type checking](/guide/type-checking) for what it checks and how to run it in CI.

## clarusjs explain

Explains where each part of a built route runs: how it was rendered, its data, its islands and when they attach, and the JavaScript and CSS it ships. Reads `dist/clarusjs-manifest.json`, so run `vite build` first.

```sh
clarusjs explain [route] [--root dir] [--json]
```

| Option | Meaning |
|---|---|
| `route` | a route such as `/guide/state`; without one, every route is listed with its island count and JavaScript |
| `--root dir` | project folder (default: the current folder) |
| `--json` | print the route's manifest entry as JSON |

```sh
$ clarusjs explain /guide/state
/guide/state
  Rendered    at build time, to dist/client/guide/state/index.html
  Data        no loader
  Islands     theme-toggle (0.4 KB, on page load)
              copy (0.3 KB, on first interaction)
  JavaScript  4.3 KB on page load, 4.6 KB in all (gzip, 4 files)
  CSS         /assets/src/styles/docs-C2a9Lf0q.css, /assets/cl-styles-D3qK0wPz.css
```

A route with [folder or config layouts](/guide/layouts#folder-layouts) or [guards](/guide/auth#guarding-a-folder) gets two more rows (since 0.17.0): its layouts, outermost first, and its folders' `+guard.ts`, outer first.

```sh
  Layouts     src/layouts/site.tscl
              src/pages/admin/+layout.tscl
  Guards      src/pages/+guard.ts
              src/pages/admin/+guard.ts
```

Exits with 1 when the route doesn't exist or the site hasn't been built.
