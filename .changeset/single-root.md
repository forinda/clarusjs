---
"clarusjs": minor
"@clarusjs/theme-docs": patch
"@clarusjs/ai": patch
---

One root per component, `<fragment>`, and `@extends`.

- `<fragment>` groups elements without rendering one, anywhere in a template (a component's root, an `@if` branch, a `@for` row, slot content). It takes no attributes, and a component whose root is one takes none from its parent: `clarusjs check` reports any `class`, attribute or `(event)` written on its tag.
- The `one-root` lint rule warns about a component (not a page, layout or whole document) without one root element, so what a parent passes always has one place to land. It becomes an error in a later minor.
- `@extends button` (or `input`, `textarea`, `select`, `option`, `a`, `img`, `form`, `label`, `details`, `dialog`): the component takes every attribute of that element, typed by `clarusjs check`, onto its root, which must be that element.
- theme-docs: the page head and the contents part render a `<fragment>` (same HTML). The agent guidance teaches one root.
