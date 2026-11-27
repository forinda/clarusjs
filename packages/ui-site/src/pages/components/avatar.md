---
title: "Avatar"
group: "Media"
order: 10
description: "A round picture of someone, or their initials."
---

# Avatar

<p class="lead">A round picture of someone, or their initials.</p>

<avatarDemo />

## Usage

<<< ../../registry/avatar-demo.tscl

## API

<componentApi name="avatar" />

## Source

Copy it into `src/components/ui/` as `avatar.tscl`: in plain CSS, or in Tailwind classes (switch below; the Tailwind version needs `tailwind.css`).

<sourceFlavor name="avatar">

<<< ../../registry/avatar.tscl

<<< ../../registry/avatar.tw.tscl

</sourceFlavor>

## Styling

- **On the root:** `class`, `style`, `id`, `aria-*` and `data-*` written on the tag land on its root element; `class` and `style` merge with its own.
- **Inner pieces:** `parts` takes an object of attributes (`class`, `style`, `data-*`) for each of `image`, `fallback`, spread on that piece: `[parts]="{ image: { class: 'my-image' } }"`.
- **Selectors:** `data-part` names `avatar`, `avatar-image`, `avatar-fallback`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="avatar" />
