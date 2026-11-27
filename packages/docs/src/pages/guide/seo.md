---
title: "SEO"
group: "Build & deploy"
order: 4
description: "Titles and descriptions, canonical URLs and social cards, the sitemap and robots.txt, and structured data with clarusjs/seo."
---

# SEO

<p class="lead">Pages are HTML from the server, so search engines read them as visitors do. This guide covers what to add on top, most of it from one plugin option, <code>site</code>.</p>

## Titles and descriptions

A page sets its own title and description in `<cl-head>`, anywhere in its template. The tags move into the `<head>`:

```tscl [src/pages/pricing.tscl]
<cl-head>
  <title>Pricing</title>
  <meta name="description" content="Plans for teams of every size, billed monthly or yearly." />
</cl-head>

<h1>Pricing</h1>
```

The plugin's `head.titleTemplate` wraps every page's title, so `'%s · Acme'` makes it `Pricing · Acme`. Its `head.tags` go on every page unless the page has its own tag with the same key. A Markdown page sets `title` and `description` in its frontmatter. See [the head option](/reference/vite-plugin#head).

## Canonical URLs and social cards

Give the plugin the site's public address:

```ts [vite.config.ts]
clarusjs({ site: { url: 'https://acme.example', name: 'Acme', image: '/og.png' } })
```

Every page then gets a canonical link and social cards: Open Graph and Twitter tags made from its title, its description, its URL and an image. The image is the page's own `og:image`, or `site.image`. Images are made absolute, and a relative card image without `site` fails the build, so a card never breaks silently. See [the site option](/reference/vite-plugin#site).

## Sitemap and robots.txt

With `site.url` set, `vite build` writes `sitemap.xml` and `robots.txt` on its own. `robots.txt` allows every crawler and points at the sitemap, unless `public/robots.txt` exists. The sitemap lists every static page, under the site URL and the base.

**Dates.** Each page's `lastmod` is its source file's last commit (`.tscl` or Markdown). CI usually clones shallowly, which gives every page the latest commit's date: fetch the full history (`fetch-depth: 0` on GitHub Actions) for exact dates. A page whose content changes without a commit to its file (it reads data, say) sets its own date:

```tscl
<cl-head>
  <meta name="sitemap:lastmod" content="2026-11-01" />
</cl-head>
```

**Leaving pages out.** By path with the plugin's `exclude` (`'/legal'`, `'/tags/*'` for one segment, `'/drafts/**'` for any depth). A page leaves itself out with `<meta name="sitemap" content="false">` in its `<cl-head>`, and a `noindex` page is left out on its own. The markers are removed from the built page.

```ts [vite.config.ts]
clarusjs({ site: { url: 'https://acme.example' }, sitemap: { exclude: ['/legal', '/drafts/**'] } })
```

**Images.** Each page's images are listed with it, in Google's image extension, as absolute URLs (a CDN's too), so they're found with their page. Decorative images (`alt=""`) aren't listed. `sitemap: { images: false }` leaves them all out.

**Server and client routes.** The build can't list pages it doesn't write. Add them with `include`, a list of paths or a function returning one. The function may be async, to read them from a database while the site builds:

```ts [vite.config.ts]
clarusjs({
  site: { url: 'https://acme.example' },
  routes: { '/shop/*': 'server' },
  sitemap: { include: async () => (await products()).map((p) => `/shop/${p.slug}`) },
})
```

**Translations.** A translated page lists its versions with `<link rel="alternate" hreflang="…">` in its `<cl-head>`. The sitemap repeats them for each URL, as search engines ask.

**Size.** Past 50,000 URLs (or 50 MB), the build splits the sitemap into `sitemap-1.xml`, `sitemap-2.xml`… and `sitemap.xml` becomes their index, so `robots.txt` and search consoles keep one address. `sitemap: false` turns the sitemap off, and `robots: false` turns off `robots.txt`. See [the sitemap option](/reference/vite-plugin#sitemap) for every detail.

## Markdown pages

A Markdown page (from [`@clarusjs/content`](/guide/markdown)) sets the same things in its frontmatter:

```md [src/pages/blog/launch.md]
---
title: We launched
description: What's in the first release, and what's next.
image: /cards/launch.png
lastmod: 2026-11-20
jsonLd:
  "@context": https://schema.org
  "@type": Article
  headline: We launched
  datePublished: 2026-11-20
head:
  - [link, { rel: alternate, hreflang: fr, href: /fr/blog/launch }]
---
```

| Key | What it does |
|---|---|
| `title`, `description` | passed to the page's layout, which writes them into the head, as the docs theme does. `title` defaults to the first heading's text. A page with no layout of its own (`layout: false`, or only folder layouts) gets neither: put them in `head` (`[meta, { name: description, content: … }]`, with `titleTemplate: false` for the title) |
| `titleTemplate: false` | the title as written, without the site's template |
| `image` | the page's social card image (`og:image`), made absolute with `site` |
| `lastmod` | the page's date in the sitemap, over its last commit's |
| `sitemap: false` | leaves the page out of the sitemap |
| `jsonLd` | structured data: an object or a list, written as JSON-LD scripts |
| `head` | any other tags: `[meta, { name: robots, content: noindex }]`, a canonical or `hreflang` link |

See [Markdown](/guide/markdown#head-tags) for the rest of the frontmatter.

## Structured data

Structured data tells search engines what a page is: an article with its author and date, a product with its price, the trail of pages above it. Write it as JSON-LD with `clarusjs/seo`, whose typed builders fill in schema.org's `@context` and `@type` for you:

```tscl [src/pages/blog/[slug].tscl]
@import { article, breadcrumbs } from 'clarusjs/seo'
@input post: { title: string; date: string; author: string; url: string }

<script type="application/ld+json">{{ article({ headline: post.title, datePublished: post.date, author: post.author, url: post.url }) }}</script>
<script type="application/ld+json">{{ breadcrumbs([{ name: 'Blog', url: 'https://acme.example/blog' }, { name: post.title, url: post.url }]) }}</script>

<h1>{{ post.title }}</h1>
```

A JSON-LD script takes one `{{ }}` hole holding the whole value. It's written as JSON, safe inside the script even when the data contains `</script>`.

| Builder | For |
|---|---|
| `article({ headline, datePublished, dateModified?, author?, image?, description?, url? })` | a post or article. Authors may be names or `{ name, url }`, and dates may be `Date` objects |
| `breadcrumbs([{ name, url }, …])` | the trail to a page, outermost first |
| `product({ name, offers?: { price, currency, availability? }, rating?: { value, count }, brand?, sku?, image?, description? })` | a product. `availability` is `'InStock'`, `'OutOfStock'`, `'PreOrder'`… |
| `organization({ name, url, logo?, sameAs? })` | who is behind the site |
| `website({ name, url })` | the site itself |

URLs must be absolute (`https://…`), because search engines ignore relative ones. A relative one is an error that names the field. For data on every page, pass a builder's result to the plugin's `head.jsonLd`:

```ts [vite.config.ts]
import { organization } from 'clarusjs/seo'

clarusjs({ head: { jsonLd: organization({ name: 'Acme', url: 'https://acme.example', logo: 'https://acme.example/logo.png' }) } })
```

The builders are plain functions that run where the page renders. They add nothing to the browser's JavaScript. For a type they don't cover, write the object yourself in the same hole. A Markdown page puts it in its frontmatter's `jsonLd` ([above](#markdown-pages)). Google's [Rich Results Test](https://search.google.com/test/rich-results) shows what a page's data qualifies for.

## Checklist

- `site.url` is set: canonical URLs, social cards, the sitemap and `robots.txt` follow.
- Every page has its own `<title>` and description.
- Pages that shouldn't be found have `noindex`.
- Moved pages have [redirects](/guide/routing#redirects), so old links and rankings carry over.
- Pages are fast: see [Performance](/guide/performance).
