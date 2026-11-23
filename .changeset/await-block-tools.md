---
'@clarusjs/prettier-plugin': minor
'@clarusjs/language-server': minor
'@clarusjs/eslint-plugin': patch
---

`@await`, `@then` and `@catch` blocks (#430): the Prettier plugin lays them out like `@if` / `@else` (headers kept as written), the language server hides them from the HTML service and completes the keywords, and the ESLint plugin reads their expressions.
