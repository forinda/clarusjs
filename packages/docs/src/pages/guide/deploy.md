---
title: "Deploying"
group: "Build & deploy"
order: 2
description: "Upload dist/client to any static host; this site deploys to Netlify."
---

# Deploying

<p class="lead">Upload <code>dist/client/</code> to any static host.</p>

## Netlify

This site deploys to Netlify:

```toml
# netlify.toml
[build]
  command = "pnpm install --frozen-lockfile && pnpm --filter @clarusjs/docs build"
  publish = "packages/docs/dist/client"
```

## Node {since=0.17.0}

On any host that runs Node (a VPS, Fly.io, Render, Railway, a container), build, then serve:

```sh
vite build
clarusjs serve          # $PORT (default 3000), $HOST (default 0.0.0.0)
```

`clarusjs serve` serves `dist/client`'s files, sends [server routes](/guide/rendering-modes) and endpoints to the built handler, and applies your [headers](#headers). Hashed assets are cached for a year, and pages are revalidated by their ETag. It needs only `dist/` and the app's dependencies at runtime. To mount the site in a server of your own, use `createListener()`:

```ts
import { createServer } from 'node:http'
import { createListener } from 'clarusjs/node'

const site = await createListener('.') // the folder with dist/
createServer((req, res) => {
  if (req.url === '/healthz') return res.end('ok')
  site(req, res)
}).listen(3000)
```

## Headers {since=0.17.0}

Set response headers in the plugin's [`headers`](/reference/vite-plugin#headers) option. The build writes them to `_headers`, which Netlify and Cloudflare Pages read as they are, and which `clarusjs serve` and `vite preview` apply. Every site already sends `nosniff`, a `Referrer-Policy`, and immutable caching for hashed assets.

clarusjs pages run no inline scripts (island state is JSON, and the loader is a file), so a strict Content-Security-Policy fits. Here's one to start from:

```ts
clarusjs({
  headers: {
    '/*': {
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
      'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
    },
  },
})
```

`style-src` needs `'unsafe-inline'` for the small style each page carries for islands, and for any `style=""` attributes. Add each origin your pages load from (fonts, analytics, images) to its directive.
