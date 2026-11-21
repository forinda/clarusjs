---
title: "Server"
group: "APIs"
order: 3
description: "Server code: redirect(), render() a view to HTML, readManifest(), and the built handler that serves server routes."
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

## render()

```ts
render(name: string, props: object): Promise<string>
```

From `clarusjs/views`. Renders a view (any `.tscl` under `src/`) to an HTML string, in server code: a `load()`, an endpoint, or a script importing the built server.

### Parameters

- **`name`**: the view's path under `src/`, without the extension: `'components/pill'`.
- **`props`**: its inputs.

### Returns

A promise of the HTML.

### Caveats

- **Server code only,** after the server entry has loaded: that's where the views are registered.
- **Typed once `clarusjs check` has run:** it writes `.clarusjs/views.d.ts`, and an unknown name or a wrong prop becomes a type error. Add that file to your `tsconfig.json`'s `include` to get the same types in your editor.
- **The built server, `dist/server/index.mjs`, exports `render` too.**

### Usage

```ts
import { render } from 'clarusjs/views'

const html = await render('components/pill', { text: 'new' })
```

## readManifest()

```ts
readManifest(): Manifest | null
```

From `clarusjs/manifest`. The built site's route manifest: for each route, its mode, its islands, and the JavaScript and CSS it ships.

### Returns

The manifest during `vite build`. `null` in development, and on the first prerender pass.

### Caveats

- **Node only, while prerendering.** A page that calls it during `vite build` is rendered again once the manifest is written, so it can show what the built site ships.
- **The same data is in `dist/clarusjs-manifest.json`** after the build.

### Usage

```ts
// src/pages/size.load.ts
import { readManifest } from 'clarusjs/manifest'

export function load() {
  const home = readManifest()?.routes['/']
  return { js: home?.js.gzip ?? 0 }
}
```

## The built handler

`vite build` writes `dist/server/index.mjs`. Its default export is the handler: `fetch(request)` returns a `Response`, for any server built on the Fetch API (Node with an adapter, Deno, Bun, a Netlify or Cloudflare function).

```ts
import handler from './dist/server/index.mjs'

export default { fetch: (request: Request) => handler.fetch(request) }
```

With `adapter: 'netlify'`, the build writes that function for you (see [Vite plugin](/reference/vite-plugin#adapter)).
