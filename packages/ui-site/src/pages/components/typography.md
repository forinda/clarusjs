---
title: "Typography"
group: "Misc"
order: 10
description: "Plain HTML, Markdown's or a CMS's, set from the theme: headings, lists, quotes, code and tables. CSS only."
---

# Typography

<p class="lead">Plain HTML, Markdown's or a CMS's, set from the theme: headings, lists, quotes, code and tables. CSS only.</p>

<typographyDemo />

## Usage

Import `typography.css` once and put the HTML in an element with `data-part="prose"`: no classes on what's inside, so it fits HTML you don't write yourself (a Markdown file, a CMS field, a comment). Sizes are relative to the theme's font size and the text keeps a comfortable measure (`68ch`); headings use `--ui-font-heading` when the theme sets one. With Tailwind, it works as it is: the rules sit in `@layer components`, so utilities override them.

<<< ../../registry/typography-demo.tscl

## Source

Copy it into `src/components/ui/` as `typography.css`.

<<< ../../registry/typography.css

## Styling

- **On the root:** it's your own element: give it any `class`, `style` or `max-width` you like.
- **Selectors:** `data-part` name `prose`; inside it, the elements themselves (`h1` to `h4`, `p`, `a`, `ul`, `ol`, `blockquote`, `code`, `pre`, `kbd`, `table`, `hr`, `img`, `figcaption`).
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="typography" />
