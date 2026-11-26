---
title: "Lists"
group: "Templates"
order: 6
description: "Repeat content with @for: track keys, @empty, and each row's $index, $count, $first, $last, $even and $odd."
---


# Lists

<p class="lead">Repeat content with <code>@for</code>.</p>

```tscl
<ul>
  @for (post of posts; track post.id) {
    <li>{{ $index + 1 }}. {{ post.title }}</li>
  } @empty {
    <li>No posts yet.</li>
  }
</ul>
```

- `track` gives each row a key. Without it, rows are keyed by position, and in an interactive component the compiler warns: a row's state would move to another item when the list changes order. To match rows by position on purpose, write `track $index`.
- `@empty` shows when the list is empty.

## A row's names

Besides its item, each row has:

| Name | Value |
|---|---|
| `$index` | its position, from 0 |
| `$count` | how many rows there are |
| `$first`, `$last` | whether it's the first or the last row |
| `$even`, `$odd` | whether its index is even or odd |

```tscl
@for (row of rows; track row.id) {
  <li [class]="$even ? 'even' : 'odd'">{{ $index + 1 }} of {{ $count }}{{ $last ? ' (last)' : '' }}</li>
}
```

In an interactive component they follow the list: add a row, and the old last row isn't `$last` any more.

<rowNames />

These names are taken: an item can't be called `$index`, `$count`, `$first`, `$last`, `$even` or `$odd`. A `@for` has one `track` and at most one `@empty`.

## Nested loops {since=0.17.0}

Inside a nested `@for`, `$index` and the other names are the inner loop's. To use the outer row's, name it in the outer loop's header with `let`:

```tscl
@for (section of sections; track section.id; let s = $index) {
  <h3>{{ s + 1 }}. {{ section.title }}</h3>
  @for (step of section.steps; track $index) {
    <p>{{ s + 1 }}.{{ $index + 1 }} {{ step }}</p>
  }
}
```

`let` takes any of the row's names, separated by commas: `let s = $index, last = $last`. The alias follows the row like the name it stands for. Here, adding a section at the top renumbers every step below it:

<nestedRows />

Indexing an outer loop's list with the inner `$index`, as in `sections[$index]` inside the steps loop, is a compile error that points to `let`: that `$index` counts steps, not sections, so it would read or write the wrong section. Binding a nested field two ways goes through the outer alias ([Forms](/guide/forms#large-forms)):

```tscl
<input [(value)]="order.sections[s].items[$index].name">
```

Inside an interactive component, rows with the same key keep their elements when the list changes; new rows are rendered and removed rows are cleaned up. The to-do list on the [home page](/) is built this way.
