---
title: "Writing a theme"
group: "Tooling"
order: 7
description: "A theme for a docs site is a package with a layout.tscl that takes LayoutInputs and its slots. What the docs theme makes public, and a minimal theme to start from."
---

# Writing a theme

A site's own layout wraps a theme's: `src/layouts/docs.tscl` imports `@clarusjs/theme-docs/layout.tscl` and passes it the page. A theme of your own is any package whose `layout.tscl` takes the same inputs and slots, so a site switches themes by changing one import. To change only a part of the docs theme, [replace that part](/guide/docs-theme#replacing-a-part) instead.

## The contract

The inputs are `LayoutInputs`, exported from `@clarusjs/theme-docs/nav.ts`:

| Input | What |
|---|---|
| `config: ThemeConfig` | the site's settings: brand, sections (the sidebar), footer, edit links, search… |
| `title: string` | the page's title |
| `description?`, `path?`, `source?`, `url?` | the page's description; its sidebar entry; its own route and address when they differ from that entry |
| `headings?: Heading[]` | the page's h2 and h3, for "On this page" |
| `app?: boolean` | a tool rather than a page: no sidebar or footers |

And the slots: the default one (the page), `sidebar-top`, `sidebar-bottom`, `content-top`, `content-bottom` and `footer`. A theme has them all, even empty: a site that fills one would otherwise fail to render.

`nav.ts` has what a theme needs to read `config`: `sectionKey()` (the current section), `groupsOf()` (its sidebar groups), `crumb()`, `pager()`, `editHref()`, `updatedOf()`. A theme imports them from the docs theme rather than copying them.

## What's public

These are covered by semver: a change to them is a major version of `@clarusjs/theme-docs`.

- `layout.tscl` and `lesson.tscl`: their inputs and slots.
- The [parts](/guide/docs-theme#parts) in `parts/`: their names, inputs and slots.
- `nav.ts`: its types (`ThemeConfig`, `LayoutInputs`, `Heading`, `Section`…) and functions.
- The [tokens](/guide/docs-theme#tokens) in `theme.css`.
- `themeDocs()` and its options, `callout.tscl`, `copy.tscl` and the quiz components.

Everything else is internal and may change in any release: the markup inside the parts, their class names, and the other files in the package.

## A minimal theme

A layout with a header, the sidebar, the page with "On this page", and a footer, reading `config` with the docs theme's helpers:

```tscl
{{-- acme-theme/layout.tscl --}}
@import type { ThemeConfig, Heading } from '@clarusjs/theme-docs/nav.ts'
@import { groupsOf } from '@clarusjs/theme-docs/nav.ts'
@input config: ThemeConfig
@input title: string
@input description: string = ''
@input path: string = '/'
@input source: string = ''
@input url: string = ''
@input headings: Heading[] = []
@input app: boolean = false

<html lang="en">
  <head>
    <title>{{ title }} · {{ config.brand.text }}</title>
    <meta name="description" [content]="description" />
  </head>
  <body>
    <header><a href="/">{{ config.brand.text }}</a></header>
    @if (!app) {
      <nav aria-label="Pages">
        <slot name="sidebar-top"></slot>
        @for (group of groupsOf(config.sections, path); track group.title) {
          <p>{{ group.title }}</p>
          <ul>
            @for (item of group.items; track item.href) {
              <li><a [href]="item.href" [aria-current]="item.href === path ? 'page' : false">{{ item.title }}</a></li>
            }
          </ul>
        }
        <slot name="sidebar-bottom"></slot>
      </nav>
    }
    <main id="content">
      <slot name="content-top"></slot>
      <slot />
      <slot name="content-bottom"></slot>
      @if (headings.length) {
        <aside aria-label="On this page">
          @for (h of headings; track h.id) {
            <a [href]="'#' + h.id">{{ h.text }}</a>
          }
        </aside>
      }
    </main>
    @if (!app) {
      <footer><slot name="footer">@if (config.footer) {<p>{{ config.footer }}</p>}</slot></footer>
    }
  </body>
</html>
```

A site uses it the way it uses the docs theme:

```tscl
{{-- src/layouts/docs.tscl --}}
@import theme from 'acme-theme/layout.tscl'
@import type { Heading } from '@clarusjs/theme-docs/nav.ts'
@import { config } from '../config.ts'
@input title: string
@input path: string = '/'
@input headings: Heading[] = []

<theme [config]="config" [title]="title" [path]="path" [headings]="headings"><slot /></theme>
```

A test builds and type-checks this theme as a site's, so it keeps working as the docs theme changes.

A theme with a Vite plugin of its own can hand clarusjs components that no page imports by path, such as files a site configures, so their styles and islands are built: give the plugin `api: { clarusComponents: (root) => [/* absolute paths */] }`. The docs theme does this for [replaced parts](/guide/docs-theme#replacing-a-part). Its `source` and `url` inputs are taken and unused here; the docs theme uses them for edit links and canonical addresses. Add the theme's CSS with an `@import './theme.css'` at the top of `layout.tscl`, and its own islands (a theme toggle, search) as components like any other.
