---
title: "Templates"
description: "Print values, pass inputs to components, repeat with @for and choose with @if."
group: "Your first site"
order: 2
layout: /src/layouts/lesson.tscl
steps: true
---

# Templates

A template is HTML with a few additions: holes for values, inputs for components, and blocks for lists and conditions. All of it runs on the server; the browser gets plain HTML.

## Read

- `{{ expr }}` prints a value, always escaped, so text from users can't become markup.
- `@input name: Type` declares what a component takes; `[name]="expr"` passes it.
- `@for (item of items; track item.id) { … }` repeats, and `@empty { … }` covers an empty list.
- `@if (cond) { … } @else { … }` chooses.

## Component

Make a component that takes a name:

```tscl [src/components/greeting.tscl]
@input name: string

<p>Hello, {{ name }}!</p>
```

Use it from a page, passing the input in square brackets:

```tscl [src/pages/index.tscl]
@import greeting from '../components/greeting.tscl'

<greeting [name]="'world'" />
```

<div class="result"><p>Hello, world!</p></div>

## Lists

Put some data in a module and repeat over it:

```tscl [src/pages/index.tscl]
@import { posts } from '../data/posts.ts'

<ul>
  @for (post of posts; track post.id) {
    <li>{{ $index + 1 }}. {{ post.title }}</li>
  } @empty {
    <li>No posts yet.</li>
  }
</ul>
```

<div class="result"><ul><li>1. Hello</li><li>2. Templates</li></ul></div>

## Conditions

Show something only when it applies:

```tscl
@if (posts.length > 1) {
  <p>{{ posts.length }} posts</p>
} @else {
  <p>Just one post</p>
}
```

A mistake in a template, such as an unclosed block, fails the build with the file, line and column.

## Quiz

::: quiz A post title contains `<b>`. What does `{{ post.title }}` print?
- [ ] Bold text
- [x] The characters `<b>`, escaped
- [ ] Nothing: the build fails

Holes always escape their value, so `<b>` shows as text and can't change the page's markup.
:::

## Done

You can print values, compose components, repeat and choose. Next: make part of a page interactive.

In the docs: [Holes](/guide/holes), [Inputs](/guide/inputs), [Lists](/guide/lists), [Conditionals](/guide/conditionals).
