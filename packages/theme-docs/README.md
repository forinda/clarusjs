# @clarusjs/theme-docs

A docs theme for [clarusjs](https://clarusjs.com). It gives every page:
- a **header**: brand, section links, social icons, a ⋯ overflow menu and a theme toggle;
- a **sidebar**, listed in `config` or generated from `src/pages` (`themeDocs()` Vite plugin + `pagesNav`): a drawer on small screens, with no JavaScript;
- the **content**, with a crumb, an edit link and previous/next links;
- **On this page**: a column on wide screens, a collapsible box on narrow ones.

It also has light and dark modes without a flash, copy buttons and callouts.

```sh
pnpm add -D @clarusjs/theme-docs
```

```tscl
{{-- src/layouts/docs.tscl --}}
@import theme from '@clarusjs/theme-docs/layout.tscl'
@import { config } from '../theme.config.ts'
@input title: string
@input path: string = '/'

<theme [config]="config" [title]="title" [path]="path"><slot /></theme>
```

Customize through `config`, slots (`sidebar-top`, `sidebar-bottom`, `content-top`, `content-bottom`, `footer`) and CSS custom properties. See the [docs theme guide](https://clarusjs.com/guide/docs-theme).
