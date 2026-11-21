---
title: Docs theme
group: "Site quality"
order: 1
description: Build a documentation site with @clarusjs/theme-docs - header, sidebar, content and on-this-page, configured with props, slots and CSS custom properties.
---

# Docs theme

<p class="lead">This site's look is a package, <code>@clarusjs/theme-docs</code>. Use it for your own docs: a layout with a header, a sidebar, the content and "On this page", light and dark modes, copy buttons and callouts.</p>

## Use it

```sh
pnpm add -D @clarusjs/theme-docs
```

Wrap the theme's layout in your own, with your settings:

```tscl
{{-- src/layouts/docs.tscl --}}
@import theme from '@clarusjs/theme-docs/layout.tscl'
@import type { Heading } from '@clarusjs/theme-docs/nav.ts'
@import { config } from '../theme.config.ts'
@input title: string
@input path: string = '/'
@input description: string = ''
@input headings: Heading[] = []

<theme [config]="config" [title]="title" [path]="path" [description]="description" [headings]="headings"><slot /></theme>
```

With [Markdown pages](./markdown.md), point `layout` at this file: each page's title, description and headings are passed along.

## Settings

```ts
// src/theme.config.ts
import type { ThemeConfig } from '@clarusjs/theme-docs/nav.ts'

export const config: ThemeConfig = {
  brand: { text: 'acme', accent: '.dev', logo: '/logo.svg' },
  siteUrl: 'https://acme.dev', // structured data (JSON-LD) per page
  sections: [
    { key: 'guide', title: 'Guide', href: '/guide/start', groups: [
      { title: 'Basics', items: [{ title: 'Start', href: '/guide/start' }] },
    ] },
  ],
  social: [
    { label: 'GitHub', href: 'https://github.com/acme/acme', icon: 'github' },
    { label: 'npm', href: 'https://www.npmjs.com/package/acme', icon: 'npm' },
  ],
  editLink: (path) => `https://github.com/acme/acme/edit/main/src/pages${path}.md`,
  footer: 'MIT licensed.',
}
```

A page belongs to the section whose sidebar lists it: the section is marked in the header, its groups fill the sidebar, and previous/next follow its order. Pages in no section, like a home page, get the header and footer only.

## Sidebar from the pages

Instead of listing every page, let the theme read them. Add its Vite plugin, which reads `src/pages` while the site builds (and again in dev when a page changes):

```ts
// vite.config.ts
import { themeDocs } from '@clarusjs/theme-docs/vite.js'

export default defineConfig({ plugins: [themeDocs(), clarusjs({ sources: [markdown()] })] })
```

Then `pagesNav(sections, pages)` fills each section's sidebar from its folder, `src/pages/<section key>/`:

```ts
import { pagesNav, type ThemeConfig } from '@clarusjs/theme-docs/nav.ts'
import pages from 'virtual:theme-docs/pages'

export const config: ThemeConfig = {
  brand: { text: 'acme' },
  sections: pagesNav([
    { key: 'guide', title: 'Guide', href: '', groups: [
      { title: 'Basics', items: [] }, // sets the group order
      { title: 'More', items: [{ title: 'Playground', href: '/playground', order: 9 }] }, // not under guide/
    ] },
  ], pages),
}
```

```md
---
title: "Start"
group: "Basics"
order: 1
---
```

- **Group:** the frontmatter `group`, else the page's subfolder (`guide/advanced/x.md` is in "Advanced"), else the section's title.
- **Title:** the frontmatter `title`, else the first `# ` heading; a `.tscl` page uses its layout's `[title]="'…'"`.
- **Order:** lowest `order` first, then by title. Groups the config doesn't name come after its own, in the order of their first page.
- **Left out:** `sidebar: false`, dynamic routes (`[step].tscl`) and files or folders starting with `_`.
- **The config wins:** an item it lists replaces the page with the same `href`, so it can rename or move a page and add entries that aren't pages.
- An empty `href` on a section means its first page.

Only the titles, groups and orders reach the browser (for pages it renders itself, like client routes), never the files. For the types, add `/// <reference types="@clarusjs/theme-docs/pages.d.ts" />` to a `.d.ts` in your project. This site's sidebar is built that way: [sidebar.ts](https://github.com/forinda/clarusjs/blob/main/packages/docs/src/sidebar.ts).

## Regions at every width

| Width | Sidebar | On this page | Social links |
|---|---|---|---|
| 1280px and wider | beside the content | a column on the right | icons in the header |
| 1024 to 1279px | beside the content | a box above the content | in the ⋯ menu |
| below 1024px | a drawer from ☰ | a box above the content | at the bottom of the drawer |

The drawer and the ⋯ menu are native popovers: they open and close without JavaScript, and Escape or a click outside closes them. The header stays at the top while reading. Below 700px the section links move into the drawer too.

## Slots

Add your own content in place, without copying the layout:

```tscl
<theme [config]="config" [title]="title" [path]="path">
  <slot />
  @slot('sidebar-top') {<a class="banner" href="/learn">New: the learning path</a>}
  @slot('footer') {<p>© Acme</p>}
</theme>
```

The slots are `sidebar-top`, `sidebar-bottom`, `content-top`, `content-bottom` and `footer` (it replaces `config.footer`).

## Tokens

Every colour, font and size is a CSS custom property on `:root`, so you can restyle the theme from your own stylesheet without overriding its rules:

```css
:root {
  --accent: #7c3aed;
  --accent-soft: rgba(124, 58, 237, 0.1);
  --sidebar-width: 280px;
}
```

| Token | What |
|---|---|
| `--bg`, `--surface`, `--fg`, `--muted`, `--rule` | page, raised surfaces, text, secondary text, lines |
| `--accent`, `--accent-soft` | links, the current page, focus rings, and their tint |
| `--code-bg`, `--shiki-bg` | inline code, and highlighted code blocks |
| `--line-highlight`, `--line-add`, `--line-remove` | highlighted and diff lines in code |
| `--sans`, `--mono` | fonts |
| `--header-height`, `--sidebar-width`, `--toc-width` | layout sizes |

Dark mode redefines the colour tokens under `prefers-color-scheme: dark` and `[data-theme='dark']` (the toggle); redefine yours in the same places.
