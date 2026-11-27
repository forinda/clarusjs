---
title: "Performance"
group: "Build & deploy"
order: 6
description: "What clarusjs does for speed on its own, what a site should do (images, fonts, caching, third-party scripts), and how to measure it and keep it fast."
---

# Performance

<p class="lead">A clarusjs page is HTML from the server, plus JavaScript only for its interactive parts. Most of the speed comes from that, and this guide covers the rest.</p>

## What clarusjs does on its own

- **Only islands ship JavaScript.** A component without a `<script>` or a `@model` input sends nothing to the browser. A page of text and static components loads only the small island loader, or nothing.
- **Islands attach to the server's HTML** without rendering it again, so content shows before any script runs.
- **Code can wait.** [`attach="idle"`, `"visible"` or `"interaction"`](/guide/lazy-attach) loads an island's code later, and replays what the visitor did in the meantime.
- **Budgets are tests.** The browser runtime stays under 5 KB gzip, and the framework's own tests fail if it grows past that.
- **Hashed files are cached for good.** Vite names them by their content, and the default [headers](/guide/deploy#headers) mark `/assets/*` immutable. Pages are revalidated, so a deploy shows at once.
- **Builds are small.** Template whitespace is collapsed (`collapseWhitespace`). [`compress: true`](/reference/vite-plugin#compress) writes Brotli and gzip copies for servers that send them as they are, such as `clarusjs serve`, nginx and Caddy.
- **Navigation can skip full loads.** [Fragment navigation](/guide/fragment-navigation) swaps only the part of the page that changes, and view transitions animate it.

## Images

Images are often most of a page's weight, and the largest one is often what the page waits on.

```tscl
<img src="/hero.avif" alt="The dashboard" width="1200" height="630" fetchpriority="high" />
<img src="/team.webp" alt="The team at work" width="800" height="533" loading="lazy" decoding="async" />
```

- Give every image `width` and `height` (its real ratio), so the layout doesn't jump when it loads.
- Load images below the fold with `loading="lazy"`. Give the main image at the top `fetchpriority="high"` and no lazy loading: it's usually the page's largest paint.
- Serve AVIF or WebP, at the size they're shown. `<picture>` and `srcset` let the browser pick a size.

## Fonts

- Self-host fonts in `public/` (or import them through CSS so Vite hashes them), rather than loading them from another origin.
- Use `font-display: swap` so text shows in a fallback font at once.
- Preload the one or two files the first screen uses, from the plugin's `head.tags`:

```ts [vite.config.ts]
clarusjs({ head: { tags: [['link', { rel: 'preload', href: '/fonts/inter-var.woff2', as: 'font', type: 'font/woff2', crossorigin: true }]] } })
```

## Third-party scripts

Analytics, chat widgets and embeds often cost more than the whole site. Load them with `async` or `defer`, and only on the pages that need them. Prefer a lighter alternative where one exists. An embed (a video, a map) can be an island with `attach="visible"` or `"interaction"`, which loads it when the visitor gets to it.

## Measuring

- **`clarusjs explain <route>`** shows where a built route's parts run: its islands, when each attaches, and its JavaScript on page load and in all, in gzip bytes. See [the CLI reference](/reference/cli#clarusjs-explain).
- **Lighthouse**, in Chrome's DevTools or as `npx lighthouse https://… --view`, measures a page's load (LCP, CLS, total blocking time) on a throttled phone profile. Measure the built site (`vite build` then `vite preview`, or the deployed one), not the dev server, which serves unbundled source.
- **The network panel**, with JS filtered, shows what each page loads, and when.

## A JavaScript budget per page

The build writes each route's JavaScript sizes to `dist/clarusjs-manifest.json` (see [the route manifest](/guide/build#the-route-manifest)). A test can then fail when a page grows past its budget:

```ts [test/budget.test.ts]
import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'

// Run after vite build. initialGzip: what loads with the page; gzip: with every lazy island too.
const { routes } = JSON.parse(readFileSync('dist/clarusjs-manifest.json', 'utf8'))

test.each(Object.entries(routes))('%s loads at most 20 KB of JavaScript', (route, entry: any) => {
  expect(entry.js.initialGzip).toBeLessThanOrEqual(20 * 1024)
})
```

Give heavier pages their own limit, rather than raising everyone's. Then a new island, or a dependency it pulls in, shows up as a failing test rather than in field data weeks later.

## Checklist

- Pages that don't need interactivity have no islands.
- Islands below the fold use `attach="visible"`, and rarely used ones `attach="interaction"`.
- Images have `width` and `height`, lazy loading below the fold, and modern formats.
- Fonts are self-hosted, swapped and preloaded.
- Third-party scripts are deferred, and only on the pages that use them.
- A budget test guards each page's JavaScript.
