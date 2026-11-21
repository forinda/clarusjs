---
title: "Server"
group: "APIs"
order: 3
description: "clarusjs/server: redirect() for a server page's load(), and the built handler that serves server routes."
---

# Server

<p class="lead">Server code: a server route's <code>load()</code>, and the handler <code>vite build</code> writes. For when a route renders on each request, see <a href="/guide/rendering-modes">Rendering modes</a>.</p>

## redirect()

```ts
redirect(to: string, status?: 301 | 302 | 303 | 307 | 308): Response
```

A redirect for a server page's `load()` to return.

### Parameters

- **`to`**: where to send the visitor: a path or a full URL.
- **`status`** (default `302`):
  - **`301`** or **`308`**: the page moved for good;
  - **`303`**: after a form is posted, so the next request is a GET;
  - **`307`**: a temporary move that keeps the method.

### Returns

A `Response` with that status and a `location` header. `load()` can return any `Response`: the handler sends it as it is.

### Caveats

- **Only server routes** run `load()` on each request. A static page's `load()` runs at build time, where a redirect would end the build.
- **Fragment navigation and the client router follow it:** the target page loads normally, and the address bar shows where it landed.

### Usage

```ts
// src/pages/account.load.ts (a server route)
import { redirect } from 'clarusjs/server'

export async function load({ request }) {
  const user = await userFrom(request)
  if (!user) return redirect('/login')
  return { user }
}
```

## The built handler

`vite build` writes `dist/server/index.mjs`. Its default export is the handler: `fetch(request)` returns a `Response`, for any server built on the Fetch API (Node with an adapter, Deno, Bun, a Netlify or Cloudflare function).

```ts
import handler from './dist/server/index.mjs'

export default { fetch: (request: Request) => handler.fetch(request) }
```

With `adapter: 'netlify'`, the build writes that function for you (see [Vite plugin](/reference/vite-plugin#adapter)).
