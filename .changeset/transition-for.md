---
'clarusjs': minor
'@clarusjs/prettier-plugin': patch
'@clarusjs/eslint-plugin': patch
'@clarusjs/ai': patch
---

`@transition` around a `@for`: rows added enter and rows removed leave with the transition's classes (the leaving rows keep their place until their animations end), and rows that move slide into place with a `<name>-move` class (FLIP, translate only; skipped under reduced motion). `appear`, `duration`, `css: false` and the hooks work per row. `clarusjs check`, the lint, Prettier and the ESLint plugin read the wrapper around a `@for` too.
