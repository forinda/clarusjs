---
title: "Masonry"
group: "Media"
order: 3
description: "Photos or cards in columns at their own heights, as many columns as fit. CSS only."
---

# Masonry

<p class="lead">Photos or cards in columns at their own heights, as many columns as fit. CSS only.</p>

<masonryDemo />

## Usage

Put anything inside: each child is an item, kept whole in its column. `width` is the narrowest a column gets (`14rem` unless you say): on a wide screen that's several columns, on a phone one. The gap is `--ui-masonry-gap` (the `--ui-space-3` step). It's CSS multi-column, so there's no JavaScript and no measuring: items read down each column, then across, which suits photos and cards; for a list whose order matters across rows, use a grid.

For a gallery, give each `<img>` its `width` and `height` (the browser keeps the space while it loads), `loading="lazy"` and an `alt`. The photos here come from [picsum.photos](https://picsum.photos), by seed, so they're the same every time.

<<< ../../registry/masonry-demo.tscl

## Examples

### Cards

Any content: text cards of different lengths.

<masonryCardsDemo />

<<< ../../registry/masonry-cards-demo.tscl

## Source

Copy it into `src/components/ui/` as `masonry.tscl`: in plain CSS, or in Tailwind classes (switch below; the Tailwind version needs `tailwind.css`).

<sourceFlavor name="masonry">

<<< ../../registry/masonry.tscl

<<< ../../registry/masonry.tw.tscl

</sourceFlavor>

## Styling

- **On the root:** `class`, `style`, `id`, `aria-*` and `data-*` written on the tag land on its root element; `class` and `style` merge with its own.
- **Selectors:** `data-part` name `masonry`; the column width is `--ui-masonry-width` and the gap `--ui-masonry-gap`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="masonry" />
