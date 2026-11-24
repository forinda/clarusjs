---
"clarusjs": minor
"@clarusjs/theme-docs": patch
"@clarusjs/ai": patch
---

One root per component, `<fragment>`, and `@extends`.

- `<fragment>` groups elements without rendering one, anywhere in a template (a component's root, an `@if` branch, a `@for` row, slot content). It takes no attributes, and a component whose root is one takes none from its parent: `clarusjs check` reports any `class`, attribute or `(event)` written on its tag.
- The `one-root` lint rule warns about a component without one root element (files under a `pages` or `layouts` folder, and whole documents, are exempt; a layout kept elsewhere is warned about), so what a parent passes always has one place to land. It becomes an error in a later minor.
- `@extends button` (or `input`, `textarea`, `select`, `option`, `a`, `img`, `form`, `label`, `details`, `dialog`): the component takes every attribute of that element, typed by `clarusjs check`, onto its root, which must be that element.
- A stateful `@extends` island kept in place when its parent re-renders takes the new passed attributes (a parent's `[disabled]` changing reaches its root).
- theme-docs: the page head and the contents part render a `<fragment>` (same HTML). The agent guidance teaches one root.
