---
title: "Lists"
group: "Templates"
order: 6
description: "Repeat content with @for: track keys, @empty, and each row's $index, $count, $first, $last, $even and $odd."
---

@import rowNames from '~/components/row-names.tscl'

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

- `track` gives each row a key. Without it, rows are keyed by position, and in an interactive component the compiler warns: a row's state would move to another item when the list changes order.
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

Inside an interactive component, rows with the same key keep their elements when the list changes; new rows are rendered and removed rows are cleaned up. The to-do list on the [home page](/) is built this way.
