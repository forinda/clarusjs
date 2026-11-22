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
  editLink: 'https://github.com/acme/acme/edit/main/src/pages/:file', // see below
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
      { title: 'Basics', icon: 'book', items: [] }, // sets the group order
      { title: 'Deploying', icon: 'rocket', collapsed: true, items: [] },
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
- **Icons and collapsing:** a group's `icon` shows beside its title (`info`, `code`, `box`, `shield`, `download`, `book`, `terminal`, `sparkles`, `layers`, `wrench`, `rocket`, `file`), and `collapsed: true` keeps it closed until opened. The group holding the current page is always open, and opening and closing needs no JavaScript.
- **Badges:** a page's frontmatter `badge: "New"` (or an item's `badge`) shows a small label beside it.
- **The phone drawer:** "Menu", a switch between the sections (leave one out with `switch: false` on it), the groups, and a row of links at the bottom: the config's `menuLinks` (`[{ label: 'Releases', href: '/releases' }]`), then its `social` links.

Only the titles, groups and orders reach the browser (for pages it renders itself, like client routes), never the files. For the types, add `/// <reference types="@clarusjs/theme-docs/pages.d.ts" />` to a `.d.ts` in your project. This site's sidebar is built that way: [sidebar.ts](https://github.com/forinda/clarusjs/blob/main/packages/docs/src/sidebar.ts).

## Edit links and last updated

Give the theme the pages `themeDocs()` read, and each page's footer gets an "Edit this page" link and the date of the last commit that changed its source file:

```ts
import pages from 'virtual:theme-docs/pages'

export const config: ThemeConfig = {
  // …
  editLink: 'https://github.com/acme/acme/edit/main/src/pages/:file', // :file = guide/start.md
  pages,
}
```

- **`:file`** is the page's source under `src/pages`, with its extension, so Markdown and `.tscl` pages both link right. A dynamic page (`releases/[version].tscl`) passes its route pattern as `source` and links to that file.
- **Last updated** comes from one `git log` for all pages, the same one the sitemap uses. A page git doesn't know yet (not committed) shows no date. In CI, check out the full history (`fetch-depth: 0` on GitHub Actions): a shallow clone dates every page to the last commit.
- `editLink` can still be a function of the route, for links that aren't one pattern.

## Search

Set `search: true` in the config, and keep `themeDocs()` in `vite.config.ts`: after the build it reads every built page and writes a search index next to them, in `dist/client/search/`.

- **Sections:** each page is split at its headings (h1 to h3 with an id), so a result links to the part of the page that matches. The theme's own parts (crumb, contents, footer) aren't indexed. Pages with `noindex`, or with `data-search="false"` in their content, are left out.
- **Small files, loaded on demand:** words are grouped by their first two letters (`t-is.json`), sections in chunks of 64 (`s-0.json`). A query fetches one word file per word it has and the sections of its best results, never the whole index.
- **Ranking:** every word must match, the last one as a prefix, so results come while typing. A word in a heading counts more than one in the text, and a word repeated all over a long page counts no more than three uses.
- **The dialog:** the header button, <kbd>Ctrl</kbd>/<kbd>⌘</kbd> <kbd>K</kbd> or <kbd>/</kbd> open it. It's a native modal `<dialog>`: focus stays inside, <kbd>Escape</kbd> closes it, and focus goes back. Arrow keys move through the results, <kbd>Enter</kbd> opens one, and the number of results is announced.

`themeDocs({ search: false })` skips the index.

## llms.txt

`themeDocs({ llms })` writes two files for AI tools after the build, as [llmstxt.org](https://llmstxt.org) describes:

```ts
themeDocs({ llms: { title: 'My docs', summary: 'What the project is, in a sentence.', site: 'https://example.com' } })
```

- **`/llms.txt`:** the title and summary, then each sidebar group with its pages as links, with their descriptions from the frontmatter. Groups come in the order of their pages' `order`; pages without a group come last.
- **`/llms-full.txt`:** the same pages' text, one after another. A Markdown page is its Markdown, without frontmatter or imports; a template page is its built page's text.

Pages hidden from the sidebar, dynamic routes and the 404 and 500 pages aren't listed. Without `site`, links are root-relative.

## Lessons

`@clarusjs/theme-docs/lesson.tscl` is a layout for tutorials: a focused header, the lesson, and an action bar fixed to the bottom. A lesson is a Markdown page with `steps: true`, so each `##` section is a step:

```md
---
title: "Install and a first page"
layout: /src/layouts/lesson.tscl
steps: true
minutes: 5
---

# Install and a first page

## Read
…
## Write
…
```

- **Header:** a ✕ to leave (the section's link), "Learn · Lesson 1 of 6" (the lessons are the items of the config section the page is in), one segment per step, and a `header-end` slot.
- **One step at a time:** with JavaScript, the bar shows one step, with Back, the step's name and Continue; the URL follows the step (`#write`) and the segments fill in. After the last step, Continue goes to the next lesson. Without JavaScript the bar stays hidden and the lesson is one plain page; the segments jump to each step.
- **Quizzes:** on a step with a quiz the main button is **Check**: the bar turns green ("Correct!") or red ("Not quite", with the right answer), then Continue. The quiz marks the right option and a wrong pick in words as well as colour.
- **Code beside the text:** from 1024px, a step's code blocks and `.result` boxes sit in a column to the right of its text.
- **Reduced motion:** steps change without animation.
- **The path:** with `learn` set (below), from 1024px a lesson has the path beside it: the course (its sidebar group) and how many lessons are done, each lesson with the XP it can earn (50, plus 10 a step and 20 a quiz, counted from the page) and its frontmatter `minutes`, marked done, next or locked from your progress, this lesson's steps following along, and your XP and badges, linking to the progress page.

## Progress, XP and badges

Tell the theme which section is Learn and where its progress page is, and lessons keep track of what was done:

```ts
export const config: ThemeConfig = {
  // …
  learn: { section: 'learn', progress: '/learn/progress' },
}
```

```tscl [src/pages/learn/progress.tscl]
@import learnProgress from '@clarusjs/theme-docs/learn-progress.tscl'
…
<learnProgress [config]="config" />
```

- **Kept in the browser only:** steps seen, lessons finished and the first answer to each quiz go in one `localStorage` key (`clarusjs-learn`, versioned). Nothing is sent anywhere; there are no accounts.
- **XP and badges** are computed from it: 10 XP a step, 50 a lesson, 20 a quiz answered right the first time. Badges: First lesson, Halfway, Path complete, Sharp (5 quizzes right).
- **Where it shows:** an XP chip in the lesson header and on the section's pages; in the Learn sidebar each lesson is marked done, up next or not started (a hint: every lesson stays open); the progress page has XP, lessons, quiz accuracy, badges and a Reset button.
- **When storage is blocked** the progress page says so and lessons work as usual; without JavaScript the progress page lists the lessons as links.
- Finishing the last lesson, and ✕ in a lesson, lead to the progress page.

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

## Parts

The layout is made of parts, each a component in `@clarusjs/theme-docs/parts/`. Use them on their own when you compose a layout of your own:

| Part | What | Inputs | Slots |
|---|---|---|---|
| `header.tscl` | the menu button, brand, section links, Learn status, search, social links, theme toggle | `config`, `path`, `app` | |
| `sidebar.tscl` | the page list: a drawer below 1024px, beside the content from 1024px | `config`, `path` | `top`, `bottom` |
| `contents.tscl` | "On this page": a column, or with `inline` a box above the content | `headings`, `inline` | |
| `page-footer.tscl` | the edit link, last updated, and the previous and next pages | `config`, `path`, `source` | |
| `footer.tscl` | the site footer: `config.footer` | `config` | default |

```tscl
@import siteHeader from '@clarusjs/theme-docs/parts/header.tscl'
@import { config } from '../theme.config.ts'
@input path: string = '/'

<siteHeader [config]="config" [path]="path" />
<main><slot /></main>
```

## Replacing a part

To change a part's markup rather than add to it, give `themeDocs()` a file of your own for it. The layout uses yours in place of the theme's; the other parts stay the theme's:

```ts [vite.config.ts]
themeDocs({ components: { footer: '/src/theme/footer.tscl' } })
```

```tscl
{{-- src/theme/footer.tscl --}}
@import type { ThemeConfig } from '@clarusjs/theme-docs/nav.ts'
@input config: ThemeConfig

<footer class="site-footer">
  <slot>@if (config.footer) {<p>{{ config.footer }}</p>}</slot>
  <nav><a href="https://github.com/acme/docs">GitHub</a></nav>
</footer>
```

The names are `header`, `sidebar`, `contents`, `pageFooter` and `footer`. Your file gets the same inputs as the part it replaces (see the table above), and must have the same slots, since the layout fills them; it needn't declare every input, but any input it requires must be one the layout passes. It may be anywhere in the project: its styles and islands are built like those of your own components. A mistake is a build error that says what to fix. Starting from a copy of the theme's part keeps its classes, so the theme's CSS still applies. This site's footer is replaced this way.

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
| `--header-height`, `--sidebar-width`, `--toc-width`, `--page-width` | layout sizes (`--page-width`: the widest the page gets; the header lines up with it) |

Dark mode redefines the colour tokens under `prefers-color-scheme: dark` and `[data-theme='dark']` (the toggle); redefine yours in the same places.

The theme's styles are written with Tailwind and shipped as a built stylesheet, so your site needs no Tailwind to use it. Its utilities are built on these tokens, so changing a token restyles them too. Only the utilities its own parts use are in it (`flex`, `bg-surface`…), with Tailwind's names: a site using Tailwind gets the same meaning for the same class.
