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

Also fixed: when a client route swapped in, its page's JSON-LD or JSON `<script>` in the head ran as JavaScript and threw. Now only real scripts run, and a module script keeps its type.
