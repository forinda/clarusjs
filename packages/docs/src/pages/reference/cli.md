---
title: "CLI"
group: "APIs"
order: 3
description: "The clarusjs command line: check, explain and serve."
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

## clarusjs serve {since=0.17.0}

Serves a built site on Node: run `vite build` first. For any Node host or a container; see [Deploying](/guide/deploy#node).

```sh
clarusjs serve [dir] [--port 3000] [--host 0.0.0.0]
```

| Option | Meaning |
|---|---|
| `dir` | project folder, the one with `dist/` (default: the current folder) |
| `--port` | port (default: `$PORT`, else 3000) |
| `--host` | interface to listen on (default: `$HOST`, else `0.0.0.0`, every interface) |

Each request gets a file from `dist/client` (a page from `<path>/index.html`), else a server route or endpoint, else `404.html` with status 404. It applies `dist/client/_headers` (see [headers](/reference/vite-plugin#headers)) and sends files with an ETag. Hashed assets are cached for a year, and everything else is revalidated (`Cache-Control: no-cache`). The `.br` and `.gz` copies from [`compress: true`](/reference/vite-plugin#compress) are sent when the browser accepts them. On `SIGTERM` it finishes the requests in flight, then exits.
