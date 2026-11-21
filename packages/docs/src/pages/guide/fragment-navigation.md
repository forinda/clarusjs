---
title: "Fragment navigation"
group: "Interactivity"
order: 6
description: "Move between server-rendered pages without reloading: swap the page region, keep persisted elements, attach new islands."
---

# Fragment navigation

<p class="lead">With fragment navigation on, moving between pages swaps the changed part of the page instead of reloading it. Every page is still a complete HTML page that works without JavaScript.</p>

```sh
clarusjs({ fragments: true })
```

## How it works

1. The build writes each page's fragment next to it: `guide/lists/index.frag.html` holds the page's title and its swap region. Server routes serve theirs from the handler.
1. A small script (under 1 KB gzip) handles clicks to other pages on the site: it fetches the fragment, swaps the region, updates the title and attaches the page's islands.
1. Back and forward work as usual. If anything fails, the page loads normally.

## Choosing what's swapped

Mark the region with `data-cl-swap`; without one, the whole `<body>` is swapped. This site swaps the body, so the sidebar and the header follow the page.

```tscl
<body>
  <header>…</header>
  <main data-cl-swap>…</main>
</body>
```

## Keeping elements

An element marked `data-cl-persist="key"` is kept across swaps: the one already on the page moves into the new page, in place of the new page's element with the same key. Its state, and any island in it, stay as they are.

```tscl
<span data-cl-persist="theme"><themeToggle /></span>
```

::: tip
This site uses fragment navigation. Change the theme, then follow a link in the sidebar: the page changes without a reload, and the theme toggle is the same element it was.
:::
