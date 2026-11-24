---
"clarusjs": patch
---

Attributes passed to a component also land on its root when the top level is one `@if` … `@else` with a single element in each branch (outside islands): the branch that renders gets them. A button that renders an `<a>` when given `href` keeps `aria-*`, `data-*`, `id` and `style` either way.
