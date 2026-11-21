---
title: "Rendering modes"
group: "Introduction"
order: 5
description: "Choose per route whether a page is prerendered at build time or rendered on every request."
---

# Rendering modes

<p class="lead">Each route chooses when it renders. The default is at build time; routes that depend on the request render on the server instead.</p>

<table>
    <thead><tr><th>Mode</th><th>Renders</th><th><code>load()</code> runs</th><th>Good for</th></tr></thead>
    <tbody>
      <tr><td><code>static</code></td><td>once, at build, to an HTML file</td><td>once per page, at build</td><td>docs, blogs, marketing pages</td></tr>
      <tr><td><code>server</code></td><td>on every request, by the server</td><td>on every request, with the request</td><td>accounts, search, anything per visitor</td></tr>
      <tr><td><code>client</code></td><td>in the browser, by the router</td><td>once per page, at build (served as <code>__data.json</code>)</td><td>app-like sections where moving between pages shouldn't reload; see <a href="/guide/client-routes">Client routes</a></td></tr>
    </tbody>
  </table>

## Choosing a mode

List the routes that aren't static in the plugin options. A folder pattern such as `/account/*` covers the folder and everything under it; the most specific pattern wins.

```ts
// vite.config.ts
clarusjs({
  routes: {
    '/account/*': 'server',
    '/account/help': 'static',
  },
})
```

## Server routes

A server route is never prerendered, so a dynamic one needs no `entries()`. Its `load()` gets the visitor's `request`, for cookies, headers or query parameters.

```ts
// src/pages/account/[id].load.ts
export async function load({ params, request }) {
  const session = await getSession(request.headers.get('cookie'))
  return { account: await findAccount(params.id, session) }
}
```

`vite build` writes static routes to `dist/client` and leaves server routes to the handler in `dist/server/index.mjs`, a `fetch(Request)` function. `vite preview` serves both, and `clarusjs explain` shows each route's mode.

## Deploying server routes

On Netlify, add `adapter: 'netlify'`. The build then writes a Netlify Function that runs the same handler for the server routes only; static routes stay files and are served first.

```sh
clarusjs({
  routes: { '/account/*': 'server' },
  adapter: 'netlify',
})
```

Anywhere else, serve `dist/client` as static files and send the server routes to `dist/server/index.mjs`: its default export has `fetch(request)`, and `isServerPath(pathname)` says which requests are its own.

::: tip
This site's [server playground](/playground) is a server route on a Netlify Function; every other page is a static file.
:::
