---
title: What is clarusjs?
description: clarusjs compiles templates to server HTML and ships JavaScript only for the interactive parts.
---
# What is clarusjs?

<p class="lead">clarusjs is a compiled view framework built on Vite. You write components in a familiar template language; clarusjs turns them into plain server HTML and ships JavaScript only for the parts of a page that are interactive.</p>

## What makes it different

- **HTML first.** A component without a `<script>` is HTML only, forever, at zero JavaScript cost.
- **No hydration.** Interactive components (islands) attach to the HTML the server already sent. Nothing re-renders, so nothing can mismatch.
- **Errors at build time.** Template mistakes fail the build with a file, line and column, and `clarusjs check` type-checks templates with TypeScript.
- **Readable output.** The compiled JavaScript is short and plain. You can open it and follow it.

<!-- @include: ../../parts/requirements.md -->

## When to use it

clarusjs fits sites that are mostly content with interactive parts: documentation, marketing sites, blogs, shops, dashboards with a few live widgets. If every part of every screen is interactive (a design tool, a spreadsheet), a client-side framework is a better fit.

::: info
clarusjs is early (`0.x`). This site is its proving ground: every feature is built because the site needs it, and tested here in a real browser. This page is written in Markdown.
:::
