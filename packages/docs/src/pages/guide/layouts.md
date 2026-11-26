---
title: "Layouts"
group: "Templates"
order: 9
description: "A layout is a component that renders the whole document around a page: its head, its header and footer, and a slot for the page. Inputs, named slots, head tags, styles, nesting, folder layouts, layouts in the config and Markdown pages."
---

# Layouts

<p class="lead">A layout is an ordinary component that renders the whole document (<code>&lt;html&gt;</code>, <code>&lt;head&gt;</code>, <code>&lt;body&gt;</code>) with a <code>&lt;slot /&gt;</code> where the page goes. A page wraps its content in the layout it imports; a folder's <code>+layout.tscl</code>, or the config, can wrap every page under it instead.</p>

## A layout and a page

```tscl
{{-- src/layouts/site.tscl --}}
@import '~/styles.css'
@input title: string = 'My site'

<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{{ title }}</title>
  </head>
  <body>
    <header><a href="/">My site</a></header>
    <main><slot /></main>
    <footer>© 2026</footer>
  </body>
</html>
```

```tscl
{{-- src/pages/about.tscl --}}
@import site from '~/layouts/site.tscl'

<site [title]="'About'">
  <h1>About us</h1>
  <p>Everything between the tags goes to the layout's slot.</p>
</site>
```

The content belongs to the page that writes it: its `{{ }}` holes read the page's inputs and data, not the layout's. Layouts live in `src/layouts/` by convention ([project structure](/guide/project-structure)); any folder works.

## What the server adds

You write the document; clarusjs completes it when the page is served or built:

- **`<!doctype html>`** if the page has none.
- **Stylesheets:** every component's `<style>`, and the CSS files components import, as `<link>`s in the `<head>`.
- **The island loader**, only on a page that has islands. A page without islands ships no JavaScript.
- **Site-wide head tags** from the plugin's `head` option: a title template (`'%s · My site'`), and with `site`, the canonical URL and social cards. A tag the page sets itself wins.
- **A document**, for a page that isn't one: a page without `<html>` (or without a layout) gets a minimal document around it, so it's still a valid page.
- **In dev, Vite's client**, so editing a layout, a style or a stylesheet updates the browser.

## Inputs: a title, a description

A layout takes inputs like any component: the title, a description, the current path for navigation. Give them defaults so a page only sets what it needs.

```tscl
{{-- src/layouts/site.tscl --}}
@input title: string = 'My site'
@input description: string = ''
@input path: string = '/'

<head>
  <title>{{ title }}</title>
  @if (description) { <meta name="description" [content]="description" /> }
</head>
…
<nav>
  <a href="/docs" [aria-current]="path.startsWith('/docs') ? 'page' : false">Docs</a>
</nav>
```

`clarusjs check` checks what a page passes against these inputs, as for any component.

## Named slots: a sidebar, a hero

The page fills the default slot; named slots take other parts. A slot's own content is the fallback when the page leaves it empty.

```tscl
{{-- src/layouts/docs.tscl --}}
<body>
  <aside><slot name="sidebar"><nav>…the default menu…</nav></slot></aside>
  <main><slot /></main>
</body>

{{-- a page --}}
<docs>
  @slot('sidebar') { <nav>…this section's menu…</nav> }
  <h1>Getting started</h1>
</docs>
```

See [Slots](/guide/slots) for the rules.

## Tags in the head, from a page

A page can add tags to the `<head>` the layout renders without the layout knowing about them: put them in `<cl-head>`, anywhere in the page, and the server moves them there.

```tscl
<site [title]="'Draft'">
  <cl-head><meta name="robots" content="noindex" /></cl-head>
  <h1>Not ready yet</h1>
</site>
```

A page's tag wins over the layout's and the site's with the same key (the title, a `meta` name or property, the canonical link).

## Styles

- **Site-wide CSS:** import a stylesheet in the layout (`@import '~/styles.css'`); every page using the layout gets it. It goes through Vite, so Tailwind, PostCSS and `url()`s work.
- **The layout's own markup:** a `<style scoped>` in the layout styles its header, footer and other elements.
- **The page's content:** a `<style scoped>` in the page reaches its content inside the layout too: the page's elements carry the page's scope class, even in the layout's slot.
- **A theme set before the first paint:** a `<script inline>` at the top of the layout's `<head>` ([Styles](/guide/styles)).

## Layouts inside layouts

A section's layout can wrap the site's: it adds what the section shares (a sidebar, a breadcrumb) and passes the rest on.

```tscl
{{-- src/layouts/docs.tscl --}}
@import site from './site.tscl'
@input title: string

<site [title]="title + ' · Docs'">
  <div class="docs">
    <aside>…</aside>
    <article><slot /></article>
  </div>
</site>
```

A page under `src/pages/docs/` uses the docs layout because it imports it, which keeps its layout visible in the page itself. To wrap a whole folder without each page importing it, use a folder layout.

## Folder layouts

A `+layout.tscl` in a folder of `src/pages` wraps every page in that folder and below it. A deeper folder's layout goes inside the outer one's.

```text
src/pages/
├── +layout.tscl          wraps every page
├── index.tscl
└── admin/
    ├── +layout.tscl      wraps every /admin page, inside the one above
    ├── users.tscl
    └── sign-in.tscl      @layout none: neither of them
```

```tscl
{{-- src/pages/admin/+layout.tscl --}}
@input path: string = ''
<div class="admin">
  <aside>
    <slot name="aside">
      <a href="/admin/users" [aria-current]="path === '/admin/users' ? 'page' : false">Users</a>
    </slot>
  </aside>
  <main><slot /></main>
</div>

{{-- src/pages/admin/users.tscl: only its content --}}
@slot('aside') { <a href="/admin/users/new">Add a user</a> }
<h1>Users</h1>
```

- **The page's content** goes to the layout's default slot. A page's top-level `@slot('name') { }` fills the nearest layout's named slots.
- **A layout's inputs** are `path` (the URL's path) and `params` (the route's, `{ step: '2' }` on `/tour/[step]`). Declare the ones it uses. A title per page goes in the page's `<cl-head><title>`, or the layout makes it from `params`.
- **`@layout none`** at the top of a page skips its folder and config layouts: a sign-in page under a protected folder.
- **`+` files are never routes**, so `+layout.tscl` is never served as a page.
- **Both kinds work together:** a page can still import a layout of its own, inside its folder layouts.

This site's [client tour](/tour/1) is a folder layout: `src/pages/tour/+layout.tscl` renders the docs layout with each step's title, and the step pages only write their content. It works for [client routes](/guide/client-routes) too: the router renders the layout in the browser with the route's params.

A page with a `<script>` of its own (an island page) can't have folder or config layouts yet: the compiler says so at the top of the page. Move its script into a component it uses, or add `@layout none`. A layout's own data (`+layout.load.ts`) is coming next.

## Layouts in the config

For a layout chosen by route rather than by folder, name it in the plugin's options. Patterns are written as for [rendering modes](/guide/rendering-modes): `'/admin'` is that route, `'/admin/*'` is it and every route under it, `'/*'` is every route.

```ts
// vite.config.ts
clarusjs({
  layouts: [
    { layout: '/src/layouts/site.tscl', exclude: ['/embed/*'] }, // every route but the embeds
    { layout: '/src/layouts/admin.tscl', include: ['/admin/*'], exclude: ['/admin/sign-in'] },
  ],
})
```

Config layouts go outermost, in the order written, then folder layouts from `src/pages` down, then a layout the page imports. `include` defaults to every route; `exclude` wins over it. They get the same `path` and `params`.

## Islands in a layout

A layout can contain islands: a theme toggle, a search box, a menu button. They ship on every page that uses the layout, so keep them small and give them an [attach mode](/guide/lazy-attach) (`attach="idle"`, `"visible"` or `"interaction"`) when they aren't needed right away. A layout itself has no `<script>` of its own in the usual case: a `<script>` would make the whole layout one island, with everything inside it.

## Markdown pages

With `@clarusjs/content`, Markdown pages are rendered inside a layout you name once in the config; frontmatter can pick another per page, or none.

```ts
// vite.config.ts
clarusjs({ sources: [markdown({ layout: '/src/layouts/docs.tscl' })] })
```

```md
---
title: Release notes
layout: /src/layouts/plain.tscl
---
```

The page's `title`, `description` and route (`path`) are passed to the layout as inputs. Folder and config layouts wrap Markdown pages too, as they do `.tscl` pages: a Markdown page's own layout goes inside them, and a page with none gets only them. Frontmatter `layout: false` renders the page with no layout at all, like `@layout none`. See [Markdown pages](/guide/markdown).

## A theme

A layout can come from a package: this site's is [`@clarusjs/theme-docs`](/guide/docs-theme), configured by inputs and extended through slots. [Writing a theme](/guide/writing-a-theme) shows how to make one.
