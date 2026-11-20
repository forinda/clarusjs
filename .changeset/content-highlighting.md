---
"@clarusjs/content": minor
---

Build-time code highlighting with Shiki: light and dark colours at once as CSS variables (`--shiki-light`/`--shiki-dark`), so switching theme costs only CSS and no highlighter ships to the browser; `tscl` blocks highlighted as templates. Notation `{1,3-5}`, `[!code ++/--]`, `[!code focus]`, `[!code highlight]`, `[!code error/warning]`; `:line-numbers`; a `[title]`. `::: code-group` builds radio tabs that work without JavaScript. With `copy: { tag, from }`, every block gets your copy component.
