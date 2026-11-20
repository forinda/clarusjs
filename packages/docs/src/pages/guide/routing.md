---
title: "Pages and routes"
description: "File-based routes in clarusjs, dynamic routes with [param] segments, entries() to list their pages and load() for their data."
---

# Pages and routes

<p class="lead">Every <code>.tscl</code> file under <code>src/pages</code> is a route. The file's path is the URL.</p>

<table>
    <thead><tr><th>File</th><th>URL</th></tr></thead>
    <tbody>
      <tr><td><code>src/pages/index.tscl</code></td><td><code>/</code></td></tr>
      <tr><td><code>src/pages/about.tscl</code></td><td><code>/about</code></td></tr>
      <tr><td><code>src/pages/blog/index.tscl</code></td><td><code>/blog</code></td></tr>
      <tr><td><code>src/pages/users/[id].tscl</code></td><td><code>/users/ada</code>, <code>/users/42</code>, …</td></tr>
    </tbody>
  </table>

## Dynamic routes

A segment in square brackets matches any one segment of the URL. Its value reaches the page as an input with the same name, always a string.

```tscl
{{-- src/pages/users/[id].tscl --}}
@input id: string

<h1>User {{ id }}</h1>
```

A file without brackets wins over a dynamic one, so `src/pages/users/new.tscl` handles `/users/new`.

## Listing the pages to build

A static build has to know which pages a dynamic route has. Export `entries()` from a `.load.ts` file next to the page; it returns one object per page, and may be async.

```ts
// src/pages/users/[id].load.ts
import { users } from '../../data/users.ts'

export function entries() {
  return users.map((user) => ({ id: user.slug }))
}
```

A dynamic route without `entries()` fails the build and names the file to add. Each value must be a non-empty string without `/`, and not `.` or `..`, so a page can never be written outside its folder. Other characters are fine: `{ id: 'grace hopper' }` becomes `/users/grace%20hopper`.

## Loading data

The same `.load.ts` file can export `load()`. It gets the route's `params` and the `request`, and what it returns becomes the page's inputs, next to the params.

```tscl
// src/pages/users/[id].load.ts
import { findUser } from '../../data/users.ts'

export async function load({ params }) {
  return { user: await findUser(params.id) }
}

{{-- src/pages/users/[id].tscl --}}
@import type { User } from '../../data/users.ts'
@input user: User

<h1>{{ user.name }}</h1>
```

- **Server only.** `load()` runs at build time for static pages (once per page), never in the browser, so it can read files, query a database or use secrets. Only what the page renders reaches the browser.
- **Typed.** `clarusjs check` checks what `load()` returns against the page's inputs.
- **Failures are safe.** If `load()` throws, the build fails naming the loader; a page rendered on request answers 500 with no internal details, and the error goes to the server log.

`clarusjs explain` shows which pages ran a loader.

::: tip
This site's [release notes](/releases) are a dynamic route: `src/pages/releases/[version].tscl`, with one page per version in the package changelog, each loaded by `load()`.
:::
