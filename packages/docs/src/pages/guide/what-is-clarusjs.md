---
title: What is clarusjs?
group: "Introduction"
order: 1
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

## The name

*Clarus* is Latin for "clear" or "bright" (and, of people, "famous"). It is the root of the English *clear*, *clarity* and *clarify*: the idea behind the tagline, **clear, compiled views**, where you can always see what a template becomes and where each line runs.

Say it **KLAIR-us** (/ˈklɛər.əs/), the first syllable rhyming with *air*. <pronounce /> In classical Latin it was **KLAH-roos** (/ˈklaː.rʊs/).

## When to use it

clarusjs fits sites that are mostly content with interactive parts: documentation, marketing sites, blogs, shops, dashboards with a few live widgets. If every part of every screen is interactive (a design tool, a spreadsheet), a client-side framework is a better fit.

::: info
This site is built with clarusjs: its pages are static HTML, and only the interactive parts (search, the playground, the demos) ship JavaScript. This page is written in Markdown.
:::
