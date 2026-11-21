---
title: "Pages and routes"
group: "Introduction"
order: 4
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

- **Server only.** `load()` runs at build time for static pages (once per page), never in the browser, so it can read files, query a database or use secrets. Only what the page renders reaches the browser, and that includes props passed to an island: they are written into the page and public, so never pass secrets to islands.
- **Typed.** `clarusjs check` checks what `load()` returns against a `.tscl` page's inputs (Markdown pages aren't checked yet, [#142](https://github.com/forinda/clarusjs/issues/142)).
- **Failures are safe.** If `load()` throws, the build fails naming the loader; a page rendered on request answers 500 with no internal details, and the error goes to the server log.

`clarusjs explain` shows which pages ran a loader.

::: tip
This site's [release notes](/releases) are a dynamic route: `src/pages/releases/[version].tscl`, with one page per version in the package changelog, each loaded by `load()`.
:::

## Redirects

A page that moved gets a redirect in `vite.config.ts`. The old path keeps working, and old links pass the build's link check:

```ts
clarusjs({ redirects: { '/docs': '/guide/getting-started' } })
```

The build writes a small page at each old path that sends visitors on, and a `_redirects` file, which Netlify and Cloudflare Pages answer with a real `301`. The dev server answers `301` too. This site has that one: try [/docs](/docs).

A server page's `load()` can redirect on each request instead, for example to a login page:

```ts
// src/pages/account.load.ts
import { redirect } from 'clarusjs/server'

export async function load({ request }) {
  const user = await userFrom(request)
  if (!user) return redirect('/login')  // 302; or 301, 303, 307, 308
  return { user }
}
```

`load()` can return any `Response` this way. Fragment navigation and the client router follow it: the page loads normally, and the address bar shows where it landed.

## Error pages

`src/pages/404.tscl` is shown for any unknown address, with status 404. `src/pages/500.tscl` is shown, with status 500, when a page rendered on request fails: its `load()` throws or it can't render. It gets a `status` input; the error itself only goes to the server log, so nothing internal reaches visitors. Both are also written as `404.html` and `500.html` for hosts that serve them, with links resolved from the site root.

In development a failing page shows the error itself instead, with its stack and source location, from the dev server.
