---
'clarusjs': minor
---

Vite's `base` now reaches every link. A site under a path (`base: '/docs/'`, a GitHub Pages project site) works with links written as if it were at the root:
- **Templates and Markdown:** root-relative URL attributes get the base, whether written or bound, in pages, islands and client routes.
- **Head tags:** the ones from the `head` option get it too.
- **`h()` output:** so does every element `h()` builds.
- **`navigate('/x')`:** so do paths passed to it.

A URL already under the base is left as it is, so `href()` and hand-written base links keep working. New in `clarusjs/navigation`: `withBase()` and `withoutBase()`, for URLs built in code.

The build warns about same-site links outside the base (`links.outside`), and about a route that starts with the base.

A full-URL (CDN) base (`base: 'https://cdn.example.com/docs/'`) now moves only the assets, as in Vite: pages stay at the site's root everywhere, including the sitemap, the 404 and 500 pages' links, headers, redirects, the adapters and `serve()`, which used to put them under the CDN URL's path.
