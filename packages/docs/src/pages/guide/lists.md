---
title: "Lists"
description: "Repeat content with @for, track keys and @empty."
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

- `track` gives each row a key; without it, rows are keyed by position.
- `$index` is the row's position.
- `@empty` shows when the list is empty.

Inside an interactive component, rows with the same key keep their elements when the list changes; new rows are rendered and removed rows are cleaned up. The to-do list on the [home page](/) is built this way.
