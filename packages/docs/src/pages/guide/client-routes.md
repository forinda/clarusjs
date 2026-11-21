---
title: "Client routes"
group: "Interactivity"
order: 7
description: "Routes rendered in the browser by a small router, with data from load() and navigation without reloads."
---

# Client routes

<p class="lead">A client route is rendered in the browser. Moving between client routes doesn't reload the page.</p>

```sh
clarusjs({ routes: { '/app/*': 'client' } })
```

## How it works

1. The first request returns a shell: the island loader, the router, and a table of the client routes.
1. The router loads the page's render module and its data, `<path>/__data.json`, and renders the page.
1. Clicks to other client routes are handled by the router through the Navigation API, without a reload. Browsers without it load each page normally.

Islands on a client page attach as usual. A client route's data comes from its `load()`, run at build time like a static route's, so client routes work on any static host.

## What ships

A client page sends its template, and the data it imports, to the browser: that's how it renders there. Keep secrets in `load()`, which never ships, and prefer static routes for content pages: they ship no JavaScript at all.

::: tip Try it
The [client tour](/tour/1) is three client routes on this site. Click through it: the page never reloads.
:::
