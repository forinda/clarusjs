---
title: "Deploying"
group: "Build & deploy"
order: 3
description: "What vite build makes, and how to deploy it: any static host, Netlify, Vercel, Cloudflare, Node and Docker, with headers and environment variables."
---

# Deploying

<p class="lead">A site with only static pages is a folder of files, <code>dist/client</code>, that any host serves. Server routes need a host that runs code: an adapter writes what Netlify, Vercel or Cloudflare expect, and anywhere else runs <code>clarusjs serve</code>.</p>


## A site under a path {since=0.18.0}

Set Vite's `base` in `vite.config.ts` (`base: '/docs/'`), and write links as if the site were at the root: `/guide/routing`, `/logo.svg`. The base is added for you:

- **in templates and Markdown:** every root-relative URL attribute (`href`, `src`, `srcset`, `action`, `formaction`, `poster`, `cite`, `data`), whether written (`href="/guide"`) or bound (`[href]="link"`), in pages, components, islands and client routes alike;
- **in what clarusjs writes itself:** Vite's assets, the head tags from the plugin's `head` option, `h()` output, the 404 and 500 pages, headers, redirects and the sitemap;
- **in `navigate('/account')`**, and in `href()`.

A URL already under the base is left as it is, so `href()` and hand-written `/docs/…` links work too. For URLs built in code (`fetch()`, a link a script makes), use `withBase()` from `clarusjs/navigation`; `withoutBase()` does the reverse. Full URLs, `//host`, `#…` and relative paths are never changed.

- **The build warns** about a link outside the base on the same site (a sibling project on GitHub Pages is fine; set `links: { outside: 'off' }` to stop the warning), and about a route that starts with the base itself (base `/about/` and a route `/about`): its links can't be told apart from the base's own.
- **A CDN base** (`base: 'https://cdn.example.com/'`) applies to Vite's assets only; page links stay as written.
- **Not rewritten:** URLs inside an inline `style` (`url(/x.png)`; in a stylesheet, Vite adds the base), `ping`, a preload's `imagesrcset`, and `<meta http-equiv="refresh">`. Write those with the base, or with `withBase()` in a script.

## What the build makes

`vite build` writes:

| Path | What |
|---|---|
| `dist/client/` | the site: every static page (`<path>/index.html`), `404.html`, the hashed JavaScript and CSS under `assets/`, and `public/`'s files |
| `dist/client/_headers` | your [headers](#headers), plus safe defaults, in the format Netlify and Cloudflare Pages read |
| `dist/client/_redirects` | your [redirects](/guide/routing), as 301s for the hosts that read it (each old path also gets a page that sends visitors on) |
| `dist/server/` | the handler for [server routes](/guide/rendering-modes) and endpoints, and for prerendering |

## Choosing a host

| Host | Static pages | Server routes | Setup |
|---|---|---|---|
| Any static host (GitHub Pages, S3, nginx, Caddy…) | yes | no | upload `dist/client` |
| [Netlify](#netlify) | yes | `adapter: 'netlify'` | `netlify.toml` |
| [Vercel](#vercel) | yes | `adapter: 'vercel'` | build command only |
| [Cloudflare](#cloudflare) | yes | `adapter: 'cloudflare'` | Pages, or `wrangler.jsonc` |
| [Node](#node) (VPS, Fly.io, Render, Railway) | yes | yes | `clarusjs serve` |
| [Docker](#docker) | yes | yes | the Dockerfile below |

A site's pages are static unless the [`routes`](/reference/vite-plugin#routes) option makes some `'server'`. Endpoints (`.ts` files under `src/pages`) always run per request, so a site with one needs a host from the lower rows.

## Any static host

Upload `dist/client`. A host should send `404.html` (with status 404) for unknown paths, and serve `<path>/index.html` at `<path>/`. Most do both. For a site under a path, such as `example.com/docs/` or a GitHub Pages project site, set Vite's `base` (see [A site under a path](#a-site-under-a-path)). Then upload the folder's contents to that path.

On a server of your own, with nginx for example, serve the folder like this. With [`compress: true`](/reference/vite-plugin#compress), the `.br` and `.gz` copies are sent as they are:

```nginx [nginx.conf]
server {
  root /srv/my-site/dist/client;
  gzip_static on;
  location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
  }
  location / {
    try_files $uri $uri/index.html =404;
  }
  error_page 404 /404.html;
}
```

nginx doesn't read `_headers` or `_redirects`, so write their lines in its config. For server routes, run [`clarusjs serve`](#node) and `proxy_pass` to it.

### Caddy

Caddy serves the folder the same way, and gets the site its HTTPS certificate on its own. `precompressed` sends the `.br` and `.gz` copies from `compress: true`, and `handle_errors` answers unknown paths with `404.html`:

```caddy [Caddyfile]
example.com {
  root * /srv/my-site/dist/client
  try_files {path} {path}/index.html
  header /assets/* Cache-Control "public, max-age=31536000, immutable"
  file_server {
    precompressed br gzip
  }
  handle_errors 404 {
    rewrite * /404.html
    file_server
  }
}
```

Like nginx, Caddy doesn't read `_headers` or `_redirects`: write them as `header` and `redir` lines. With server routes, let [`clarusjs serve`](#node) answer everything (files, headers and all) and put Caddy in front for HTTPS:

```caddy [Caddyfile]
example.com {
  reverse_proxy localhost:3000
}
```

## Netlify

For a static site, publish `dist/client`:

```toml [netlify.toml]
[build]
  command = "npm run build"
  publish = "dist/client"
```

For server routes, set `adapter: 'netlify'`. The build then also writes `.netlify/v1/functions/clarusjs-server.mjs`, one function for every server route and endpoint, through Netlify's Frameworks API. Static files are served first. Netlify reads `_headers` and `_redirects` from the published folder itself.

In a monorepo, set the site's package directory, in Netlify's settings, to the folder with `vite.config.ts`, where the adapter writes its function, and don't also set Netlify's `base` to it. This site deploys that way:

```toml [netlify.toml]
[build]
  command = "pnpm install --frozen-lockfile && pnpm --filter @clarusjs/docs build"
  publish = "packages/docs/dist/client"
```

## Vercel {since=0.17.0}

Set `adapter: 'vercel'`. The build writes Vercel's Build Output API to `.vercel/output`: static files, one function for server routes, and routes for your headers, redirects and 404 page.

```ts [vite.config.ts]
clarusjs({ adapter: 'vercel', routes: { '/account/*': 'server' } })
```

In the Vercel project, set the build command to `vite build` (or `npm run build`) and leave the output directory empty: Vercel uses `.vercel/output` when it's there. Add `.vercel` to `.gitignore`. A fully static site needs no adapter: set the output directory to `dist/client` instead.

## Cloudflare {since=0.17.0}

Set `adapter: 'cloudflare'`. The build adds a worker for server routes to `dist/client`, and Cloudflare serves everything else as static files, with your headers and redirects.

```ts [vite.config.ts]
clarusjs({ adapter: 'cloudflare', routes: { '/account/*': 'server' } })
```

**Pages:** set the build command to `vite build` and the output directory to `dist/client`, or run `wrangler pages deploy dist/client`. Turn on the `nodejs_compat` compatibility flag, because the server uses `AsyncLocalStorage`.

**Workers:** point a `wrangler.jsonc` at the same folder. `run_worker_first` sends the server routes to the worker, and everything else is served as a static file:

```jsonc [wrangler.jsonc]
{
  "name": "my-site",
  "main": "dist/client/_worker.js/index.js",
  "compatibility_date": "2025-09-01",
  "compatibility_flags": ["nodejs_compat"],
  "assets": { "directory": "dist/client", "binding": "ASSETS", "run_worker_first": ["/account/*"] }
}
```

A site with no server routes (and no base) gets no worker: deploy the folder as static assets alone.

```jsonc [wrangler.jsonc]
{
  "name": "my-site",
  "compatibility_date": "2025-09-01",
  "assets": { "directory": "dist/client" }
}
```

Under a base (`base: '/docs/'`), Cloudflare serves the folder at the site's root, so the worker takes the base's requests and serves its files without it. That holds even for a static site. On Workers, send the whole base to the worker first. Workers serve a matching file before running the worker, so without this, a page whose own route is `/docs/about` (the file `docs/about/index.html`) would answer `/docs/about/` instead of `/about`'s page:

```jsonc [wrangler.jsonc]
{
  "name": "my-site",
  "main": "dist/client/_worker.js/index.js",
  "compatibility_date": "2025-09-01",
  "compatibility_flags": ["nodejs_compat"],
  "assets": { "directory": "dist/client", "binding": "ASSETS", "run_worker_first": ["/docs", "/docs/*"] }
}
```
 The same happens when a site has more server routes than Pages' 100 routing rules allow: the worker then takes every request.

On Cloudflare, `process.env` holds the project's variables and secrets (with `nodejs_compat` and a compatibility date from 2025-04-01 on), so server code reads them as on any host. See [Environment variables](/guide/environment-variables).

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

## Docker {since=0.17.0}

A two-stage image: the first stage builds with the dev dependencies, and the second runs [`clarusjs serve`](#node) with only the production ones. Put `clarusjs` in `dependencies`, not `devDependencies`, because the built server imports it at runtime. Commit `package-lock.json` (run `npm install` once if you haven't): `npm ci` installs exactly what it lists, and fails without it.

```dockerfile [Dockerfile]
# A clarusjs site in a container: built with the dev dependencies, run with only the production ones.
#   docker build -t my-site . && docker run -p 3000:3000 my-site
# clarusjs is a dependency (not a devDependency): the built server imports it at runtime.
# package-lock.json must be committed (run npm install once): npm ci installs exactly what it lists.
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT}/`).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node_modules/.bin/clarusjs", "serve"]
```

```text [.dockerignore]
node_modules
dist
.git
.env*
```

```sh
docker build -t my-site .
docker run -p 3000:3000 my-site
```

It listens on `$PORT` (3000) on every interface, runs as the unprivileged `node` user, and reports itself healthy while `/` answers. On `docker stop` it finishes the requests in flight, then exits.

### With pnpm

The same two stages with pnpm. Corepack installs the pnpm version named by `packageManager` in `package.json`, and a BuildKit cache mount keeps pnpm's store between builds, so an unchanged lockfile installs from the cache:

```dockerfile [Dockerfile.pnpm]
# The same image with pnpm: a store cache between builds, and only production dependencies in the image.
#   docker build -f Dockerfile.pnpm -t my-site . && docker run -p 3000:3000 my-site
# pnpm-lock.yaml must be committed; package.json's "packageManager" picks the pnpm version (corepack).
FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY . .
RUN pnpm build && pnpm prune --prod

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT}/`).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node_modules/.bin/clarusjs", "serve"]
```

### In a pnpm workspace

In a monorepo, build the site in the repository. `pnpm deploy` then writes a folder with the site's package and its production dependencies, with workspace packages copied in rather than linked, and the image takes that folder as it is:

```dockerfile [Dockerfile.pnpm-monorepo]
# A site in a pnpm workspace (apps/my-site here): build in the repo, then `pnpm deploy` copies the site's package with
# its production dependencies only (workspace packages copied in, not linked) into a folder the image takes as is.
#   docker build -f Dockerfile.pnpm-monorepo -t my-site .   (from the repo root)
# pnpm-workspace.yaml needs `injectWorkspacePackages: true` for pnpm deploy (pnpm 10 and later).
FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable

FROM base AS build
WORKDIR /repo
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
# my-site... : the site and the workspace packages it depends on, those first.
RUN pnpm --filter "my-site..." build
RUN pnpm --filter my-site deploy --prod /deploy && cp -r apps/my-site/dist /deploy/dist

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /deploy ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT}/`).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node_modules/.bin/clarusjs", "serve"]
```

`pnpm deploy` needs `injectWorkspacePackages: true` in `pnpm-workspace.yaml` (pnpm 10 and later). `--filter "my-site..."` builds the site's workspace dependencies before the site. Keep `node_modules` and the apps' `dist` folders out of the build context with `.dockerignore`. All three Dockerfiles are in [examples/docker](https://github.com/forinda/clarusjs/tree/main/examples/docker), and CI builds and runs each one.

The example tracks no lockfile, so copy it into your own project and run `npm install` (or `pnpm install`) once before the first `docker build`. It depends on the published `clarusjs`, and a lockfile would pin a version. CI tests this checkout's code instead: [`scripts/docker-smoke.sh`](https://github.com/forinda/clarusjs/blob/main/scripts/docker-smoke.sh) packs `clarusjs` from the checkout and points the example's `clarusjs` dependency at that tarball. It then generates a lockfile for it (`npm install --package-lock-only`, or `pnpm install --lockfile-only`) and adds the tarball to the Dockerfile's `COPY`, in a temporary copy. Those are its only changes to the files above.

## Headers {since=0.17.0}

Set response headers in the plugin's [`headers`](/reference/vite-plugin#headers) option. The build writes them to `_headers`. Netlify and Cloudflare Pages read that file as it is for static files, and the Netlify function and the Cloudflare worker apply it to the responses they make (a header a route sets itself wins). `clarusjs serve` and `vite preview` apply it, and the Vercel adapter turns it into routes. Every site already sends `X-Content-Type-Options: nosniff`, a `Referrer-Policy`, and immutable caching for hashed assets. A pattern applies to its path with and without the trailing slash, and its case is ignored.

clarusjs adds no inline scripts of its own: an island's state is JSON, which a Content-Security-Policy doesn't block, and the loader is a file. A strict policy fits:

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

Inline scripts you add need allowing too. That covers a `<script inline>` (a theme script that runs before the first paint, for example) and a `head.tags` script with content (an analytics snippet). Add each one's hash to `script-src` as `'sha256-…'`: the browser's console prints it when the policy blocks the script. `style-src` needs `'unsafe-inline'` for the small style each page carries for islands, and for any `style=""` attributes. Add each origin your pages load from (fonts, analytics, images) to its directive.

## Environment variables

Server code reads `process.env`, and the browser gets only `VITE_` variables, which are written into the JavaScript at build time. See [Environment variables](/guide/environment-variables).

| Host | Where they go |
|---|---|
| Netlify, Vercel | the project's environment variables settings, for builds and functions |
| Cloudflare | the project's variables and secrets (`process.env` with `nodejs_compat`) |
| Node | the process's environment, or `node --env-file=.env node_modules/.bin/clarusjs serve` |
| Docker | `docker run -e NAME=value`, or `--env-file` |

A variable a prerendered page reads is read once, when the site builds: set it for the build too, and build again when it changes.
