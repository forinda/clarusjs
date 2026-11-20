---
title: "Vite plugin"
description: "The clarusjs Vite plugin: its routes option, and what it does in dev, build and preview."
---

# Vite plugin

```ts
import clarusjs from 'clarusjs/vite'

export default defineConfig({ plugins: [clarusjs()] })
```

## routes

**Type:** `Record<string, 'static' | 'server' | 'client'>` · **Default:** `{}` (every route is static)

When each route renders. Keys are paths (`/about`) or folders (`/account/*`, which also matches `/account`); the most specific one wins. An unknown mode, or a pattern that doesn't start with `/`, stops the build. See [Rendering modes](/guide/rendering-modes).

```ts
clarusjs({ routes: { '/account/*': 'server' } })
```

## adapter

**Type:** `'netlify'` · **Default:** none

Where server routes deploy. With `'netlify'`, `vite build` writes `.netlify/v1/functions/clarusjs-server.mjs` (Netlify's Frameworks API, read from the site's package directory: in a monorepo, set Netlify's package directory to the folder with `vite.config.ts`, and don't also set `base` to it): a function that calls `dist/server/index.mjs` for the server routes' paths, with static files served first. With no server routes, no function is written.

## fragments

**Type:** `boolean` · **Default:** `false`

Fragment navigation. Every static and server page also answers at `<path>/index.frag.html`: its `<title>` and the element marked `data-cl-swap` (or its `<body>`). `vite build` writes those files next to each static page; server routes serve them from the handler (and, with `adapter: 'netlify'`, from the function).

## links

**Type:** `{ pages?: 'error' | 'warn' | 'off'; anchors?: 'error' | 'warn' | 'off'; strict?: boolean }` · **Default:** `{ pages: 'error', anchors: 'warn' }`

Link checking after `vite build` has written every page. `pages`: links to a page or file that doesn't exist. `anchors`: links to a `#id` the target page doesn't have (pages rendered in the browser are skipped). Each problem names the source file and line, with the closest match suggested. `strict: true` makes warnings fail the build too.

## head

**Type:** `{ titleTemplate?: string; tags?: [tag, attrs, content?][] }`

Every page's `<head>`. `titleTemplate` (`'%s · Site'`) wraps the document's `<title>`. `tags` (`['meta', { name: 'theme-color', content: '#fff' }]`) go on every page, unless the page has its own tag with the same key: `title`, `meta` by `name`, `property`, `charset` or `http-equiv`, the canonical `link`, `base`.

A page adds its own tags anywhere in its template with `<cl-head>…</cl-head>`: they move into the `<head>` and win over the site's. A `<title>` there is used as written, without the template. For anything else, export `transformHead(head, page)` from `src/head.ts`: it gets the head's HTML and `{ route, path }`, and returns the new HTML.

`jsonLd` (an object or a list) adds schema.org structured data to every page, one `<script type="application/ld+json">` each. In a template, a JSON-LD script takes one `{{ }}` hole with the whole value, written as JSON (safe inside the script, never HTML-escaped): `<script type="application/ld+json">{{ { '@type': 'Article', headline: title } }}</script>`. Components with a `<script>` can't have one: JSON-LD is rendered on the server.

Analytics such as Google's gtag are site tags too. A script's content is written as given, and boolean attributes are `true`:

```ts
clarusjs({
  head: {
    tags: [
      ['script', { async: true, src: 'https://www.googletagmanager.com/gtag/js?id=G-XXXX' }, ''],
      ['script', {}, "window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-XXXX')"],
    ],
  },
})
```

Head scripts run once per full page load: with fragment navigation or client routes, later pages don't reload them. Analytics that count page views from history changes (gtag's enhanced measurement does) keep counting.

## site

**Type:** `{ url: string; name?: string; image?: string }`

The site's public address (an absolute `http(s)` URL, or the config is rejected). Every page gets a canonical link and social cards: Open Graph `og:title` (the page title, without the template), `og:description` (its description meta), `og:url`, `og:type`, `og:site_name` (`name`), `og:image` and a Twitter card (`summary_large_image` with an image). They fill in like site tags: a page's own tags win, so an article can set `og:type` or its own `og:image` in `<cl-head>` (in Markdown, frontmatter `image`).

Images are made absolute: `/og.png` is a public file under the base, `img/a.png` is relative to the page. Without `site`, a page with a relative `og:image` or `og:url` fails the build instead of shipping a card that silently breaks. Link checking also checks absolute links to the site itself.

## sitemap

**Type:** `boolean | { exclude?: string[] }` · **Default:** `true` (with `site`)

With `site` set, `vite build` writes `sitemap.xml`: every prerendered static page, under the site URL and base. Client routes (rendered in the browser), server routes, data files and fragments aren't listed, nor is a page with `<meta name="robots" content="noindex">`, which is how a page opts out. Each page's `lastmod` is the last commit of its source file (`.tscl` or Markdown), read with one `git log` for the whole site. A file git doesn't know uses `SOURCE_DATE_EPOCH` when it is set, and otherwise has no date: builds stay reproducible. CI usually clones shallowly, so every page gets the latest commit's date; fetch the full history (`fetch-depth: 0` on GitHub Actions) for exact dates. `sitemap: false` turns it off.

Leave pages out by path with `exclude`: `['/legal', '/tags/*', '/drafts/**']` (`*` is one path segment, `**` any depth). A page leaves itself out with `<cl-head><meta name="sitemap" content="false"></cl-head>`, or `sitemap: false` in Markdown frontmatter; the marker is removed from the built page.

## robots

**Type:** `boolean` · **Default:** `true` (with `site`)

With `site` set, `vite build` writes `robots.txt`: every crawler may index everything, and the sitemap's address. A `public/robots.txt` of your own is used instead; `robots: false` writes none.

## 404 page

`src/pages/404.tscl` (or `404.md`) is the page for any unknown address: in development, in server mode and in `vite preview` it is served with status 404, and `vite build` writes it to `404.html`, which static hosts serve for unknown paths. It is shown at any depth (`/a/b/c`), so its relative links are resolved from the site root: `href="guide"` means `/guide` wherever the visitor is. It is never in the sitemap. Data and fragment requests still get a plain 404.

## What it does

- **vite**: renders `src/pages/**/*.tscl` on each request.
- **vite build**: builds the client, then the server, then prerenders every static page to `dist/client`. Server routes are left to `dist/server/index.mjs`.
- **vite preview**: serves the built pages at their routes, and server routes through the built handler.
