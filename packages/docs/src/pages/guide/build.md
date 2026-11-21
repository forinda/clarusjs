---
title: "Static build"
group: "Build & deploy"
order: 1
description: "vite build writes a complete static site in three steps."
---

# Static build

<p class="lead"><code>vite build</code> produces a complete static site. It runs in three steps:</p>

1. **Client:** the island loader and one chunk per interactive component, with hashed file names.
1. **Server:** a `fetch(Request)` handler that renders every page, pointing islands at those hashed chunks.
1. **Prerender:** the handler is called once per page and the HTML is written to `dist/client/<route>/index.html`.

A page that fails to render fails the build, naming the page. `vite preview` serves the result at its routes.

## The route manifest

The build also writes `dist/clarusjs-manifest.json`: for every route, how it was rendered, which islands it has and when each attaches, and how much JavaScript it ships (gzip bytes, in all and on page load). It is read from the pages that were actually written, and it sits outside `dist/client`, so it isn't published with the site.

```json
"/guide/state": {
  "mode": "static",
  "html": "guide/state/index.html",
  "loader": null,
  "islands": [
    { "component": "theme-toggle", "attach": "load", "count": 1, "gzip": 436, … },
    { "component": "copy", "attach": "interaction", "count": 1, "gzip": 322, … }
  ],
  "js": { "files": [ … ], "gzip": 4714, "initialGzip": 4392 },
  "css": ["/assets/src/styles/docs-C2a9Lf0q.css", "/assets/cl-styles-D3qK0wPz.css"]
}
```
