---
title: Icons
group: "Templates"
order: 12
description: 'Built-in icons in clarusjs templates: <icon name="set:name" /> renders an inline SVG at build time from any Iconify set you install, with no JavaScript.'
badge: "New"
---

# Icons

`<icon>` is built in: no import, no plugin, no runtime. It renders an inline `<svg>` when your site builds, from any [Iconify](https://icon-sets.iconify.design/) icon set you install, so an icon costs a little HTML and no JavaScript.

## Install a set

Each Iconify set is a package. Install the ones you use as dev dependencies:

```sh
pnpm add -D @iconify-json/lucide
```

There are over 200 sets (`lucide`, `mdi`, `tabler`, `ph`, `simple-icons`…). Only the icons you use reach your pages.

## Use it

Name an icon as `set:name`:

```tscl
<button type="button"><icon name="lucide:rocket" /> Launch</button>
```

<p class="icon-demo"><icon name="lucide:rocket" /> Launch <icon name="lucide:sparkles" /> <icon name="lucide:feather" /></p>

That compiles to plain HTML:

```html
<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" aria-hidden="true">…</svg>
```

- **Size:** 1em high, with the width in proportion, so an icon matches the text around it. Set `width` or `height` to change it, or `font-size` on a parent.
- **Colour:** most sets draw with `currentColor`, so an icon takes the colour of its text.
- **Attributes:** `class`, `style`, `data-*` and bound attributes pass through to the `<svg>`, as on any element.

## Accessibility

An icon next to text is decoration: it gets `aria-hidden="true"`. An icon on its own needs a name, so give it an `aria-label` (or `aria-labelledby`, or `title`), and it becomes an image instead:

```tscl
<button type="button"><icon name="lucide:x" aria-label="Close" /></button>
```

## Names are chosen at build time

The icon is drawn when the site builds, so its name is written as is: `[name]="x"` is an error. To switch between icons, use `@if`:

```tscl
@if (open) {
  <icon name="lucide:chevron-down" />
} @else {
  <icon name="lucide:chevron-right" />
}
```

Inside an island's `@if` or `@for`, the icon's markup is part of the island's JavaScript, like any other markup there.

## In your editor

With the [editor support](/guide/editor), `name="…"` completes the sets you installed, then their icons, and hovering a name shows the icon. A typo is an error at its line and column, in the editor, in `clarusjs check` and in the build, with the closest names:

```console
src/pages/index.tscl:4:3 error no icon 'rokcet' in lucide (did you mean 'rocket'?)
```

A set that isn't installed says what to install. Install it, save, and the dev server finds it without a restart.

## Your own `icon` component

A component you import as `icon` takes the tag over: `@import icon from '../components/icon.tscl'` and `<icon>` is yours.
