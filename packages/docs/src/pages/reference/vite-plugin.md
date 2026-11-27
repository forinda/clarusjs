---
title: "Vite plugin"
group: "APIs"
order: 2
description: "The clarusjs Vite plugin: its routes option, and what it does in dev, build and preview."
---

# Vite plugin

## clarusjs()

```ts
clarusjs(options?: ClarusOptions): Plugin
```

The plugin. It compiles `.tscl` files, serves pages in development, and on `vite build` builds the browser code, the server and the prerendered pages.

```ts
import { defineConfig } from 'vite'
import clarusjs from 'clarusjs/vite'

export default defineConfig({ plugins: [clarusjs()] })
```

Every option is optional. The sections below describe each one.

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

A page sets its own date with `<cl-head><meta name="sitemap:lastmod" content="2026-11-01"></cl-head>`, or `lastmod: 2026-11-01` in Markdown frontmatter: it wins over the git date, for a page whose content changes without a commit to its file (it reads data, say). A full time works too (`2026-11-01T09:30:00Z`); anything else, including a day that doesn't exist (`2026-02-30`), fails the build, naming the page. This site's release notes do this: they're dated by the changelog they're built from. The marker is removed from the built page.

Each page's images are listed with it, in [Google's image extension](https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps) (`<image:image>`), so they're found with their page: every `<img>` with a `src`, resolved to an absolute URL (images on another domain, a CDN, included). Decorative images (`alt=""`) and `data:` URLs aren't listed, and at most 1,000 per page are. `sitemap: { images: false }` leaves images out.

Server and client routes aren't built, so the build can't list their URLs. Add them with `include`, a list of paths or a function returning one (it may be async, to read them from a database while the site builds):

```ts
clarusjs({
  site: { url: 'https://example.com' },
  routes: { '/shop/*': 'server' },
  sitemap: { include: async () => (await products()).map((p) => `/shop/${p.slug}`) },
})
```

Each path starts with `/`; one the build already listed isn't repeated, and one that `exclude`, a page's own opt-out or `noindex` keeps out stays out.

A translated page lists its translations in its head, as search engines ask, and the sitemap repeats them as `<xhtml:link rel="alternate">` entries:

```tscl
<cl-head>
  <link rel="alternate" hreflang="en" href="/guide/intro">
  <link rel="alternate" hreflang="fr" href="/fr/guide/intro">
  <link rel="alternate" hreflang="x-default" href="/guide/intro">
</cl-head>
```

Each `href` becomes an absolute URL; the links stay in the page too. A `<link rel="alternate">` without `hreflang` (a feed) isn't a translation and isn't listed.

A sitemap file holds at most 50,000 URLs and 50 MB (uncompressed). Past either, the build writes `sitemap-1.xml`, `sitemap-2.xml`… and `sitemap.xml` becomes their index, so `robots.txt` and search consoles keep the one address.

## robots

**Type:** `boolean` · **Default:** `true` (with `site`)

With `site` set, `vite build` writes `robots.txt`: every crawler may index everything, and the sitemap's address. A `public/robots.txt` of your own is used instead; `robots: false` writes none.

## collapseWhitespace

**Type:** `boolean` · **Default:** `true`

At `vite build`, each run of whitespace in template text becomes one character: a newline if the run had one, otherwise a space. Browsers show a run of whitespace as one space, so pages look the same, and a formatted template's indentation stays out of the HTML. Text in `<pre>`, `<textarea>`, `<script>` and `<style>`, `verbatim` contents and `{{ }}` values are left as written, and so is a non-breaking space. Whitespace between tags is collapsed, never removed. Development renders text as written. Set `collapseWhitespace: false` if your CSS gives other elements `white-space: pre` (or `pre-wrap`, `break-spaces`), where every space shows.

## compress

**Type:** `boolean` · **Default:** `false`

At `vite build`, writes `.br` and `.gz` copies next to each HTML, JavaScript, CSS, SVG, JSON and XML file in `dist/client` (with Node's own `zlib`, best compression), keeping each only when it's smaller than the original. For servers that send precompressed files as they are: nginx (`gzip_static`, `brotli_static`), Caddy (`precompressed`). Netlify, Vercel, Cloudflare and most static hosts compress on their own, so leave it off there. `vite preview` serves the copies too (brotli first, then gzip, as the browser's `Accept-Encoding` allows, with `Vary: Accept-Encoding`), so what you measure there is what such a server sends. Pages that server routes render per request are compressed by the host, or by a small wrapper around the handler.

## headers {since=0.17.0}

**Type:** `Record<string, Record<string, string>> | false`

Response headers, by path pattern: `*` matches anything (slashes too) and `:name` matches one segment.

```ts
clarusjs({
  headers: {
    '/*': { 'X-Frame-Options': 'DENY', 'Strict-Transport-Security': 'max-age=63072000; includeSubDomains' },
    '/api/*': { 'Cache-Control': 'no-store' },
  },
})
```

`vite build` writes them to `dist/client/_headers`, after any `public/_headers` of your own. Netlify and Cloudflare Pages read that file as it is, and [`clarusjs serve`](/reference/cli#clarusjs-serve) and `vite preview` apply it. Before your rules, every site gets `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` and, for Vite's hashed files under `/assets/`, `Cache-Control: public, max-age=31536000, immutable`. Patterns get the base (`/docs/*` under `base: '/docs/'`). When several patterns set the same header, their values are joined with `, `, as on those hosts. A pattern must start with `/`, and a name or value can't span lines. `headers: false` writes no `_headers`.

There's no Content-Security-Policy by default, because what it allows depends on the site. See [Deploying](/guide/deploy#headers) for one that fits a clarusjs site.

## 404 page

`src/pages/404.tscl` (or `404.md`) is the page for any unknown address: in development, in server mode and in `vite preview` it is served with status 404, and `vite build` writes it to `404.html`, which static hosts serve for unknown paths. It is shown at any depth (`/a/b/c`), so its relative links are resolved from the site root: `href="guide"` means `/guide` wherever the visitor is. It is never in the sitemap. Data and fragment requests still get a plain 404.

## Page sources

**Type:** `Source[]` (the `sources` option)

Pages in another format, turned into `.tscl` text and then compiled like any page. `@clarusjs/content` is one, for Markdown.

```ts
type Source = { extension: string; toTscl(code: string, file: string, context: SourceContext): string }
type SourceContext = { route: string; root: string; addDependency(file: string): void }
```

- **`extension`**: the file extension it handles, such as `'.md'`.
- **`toTscl(code, file, context)`**: returns the page as `.tscl` text. `context.route` is the page's route when the file is under `src/pages`, and `context.root` is the app root. Call `context.addDependency(file)` for another file the output depends on, so it's rebuilt when that file changes.

```ts
import markdown from '@clarusjs/content'
clarusjs({ sources: [markdown()] })
```

## What it does

- **vite**: renders `src/pages/**/*.tscl` on each request.
- **vite build**: builds the client, then the server, then prerenders every static page to `dist/client`. Server routes are left to `dist/server/index.mjs`. `dist/client` holds only the site: Vite's own manifest is removed once the build has used it.
- **vite preview**: serves the built pages at their routes, and server routes through the built handler. A malformed URL gets a 400, and no path reaches outside `dist/client`.
