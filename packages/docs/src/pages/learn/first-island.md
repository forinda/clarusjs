---
title: "Your first island"
description: "Add a <script> to a component: it becomes an island, the only part of the page that ships JavaScript."
group: "Your first site"
order: 3
layout: /src/layouts/lesson.tscl
steps: true
minutes: 5
---

# Your first island

Most of a page is static HTML. When one part needs to react to clicks or typing, give that component a `<script>`: it becomes an *island*, and only it ships JavaScript.

## Read

An island is rendered to HTML on the server like any component. In the browser its code *attaches* to that HTML: event handlers and updates are wired to what is already there, and nothing re-renders.

`state(initial)` makes a value reactive. You read and write it as a plain variable; the compiler turns `count++` into an update of exactly the text that shows it.

## Write

Create a counter:

```tscl [src/components/counter.tscl]
<script>
  let count = state(0)
  const double = derived(() => count * 2)
</script>

<button (click)="count++">Clicked {{ count }} times (double: {{ double }})</button>
```

Put it on a page:

```tscl [src/pages/index.tscl]
@import counter from '../components/counter.tscl'

<h1>Hello</h1>
<counter />
```

<div class="result"><p><strong>Hello</strong></p><p><button type="button" disabled>Clicked 0 times (double: 0)</button></p><p>This button is the page's only JavaScript.</p></div>

## Load later

An island's code loads with the page by default. Wait until it's needed instead:

```tscl
<counter attach="visible" />
```

`attach="idle"` waits until the browser has nothing else to do, `visible` until it scrolls into view, and `interaction` until someone clicks, types or focuses inside it. A click that arrives before the code is replayed once it attaches.

## Run

Build the site and look at `dist/client`: the page's HTML has the button already rendered, and the only script besides the small loader is the counter's.

```sh
pnpm vite build
```

## Quiz

::: quiz Which components ship JavaScript to the browser?
- [ ] Every component on the page
- [x] Only components with a `<script>`
- [ ] Only the page itself

A component without a `<script>` is HTML only. Adding a `<script>` makes it an island, and only islands ship code.
:::

## Done

You made an island and chose when it loads. Next: pages with their own URLs and data.

In the docs: [Islands](/guide/islands), [State](/guide/state), [Lazy attach](/guide/lazy-attach).
