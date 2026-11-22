---
"@clarusjs/content": minor
---

`markdown({ components: '/src/components' })` (or several folders): a Markdown page uses a component by its tag without an `@import` line. `<counter />` imports `counter.tscl`, `<todoSummary />` `todo-summary.tscl`. An explicit `@import` wins, HTML's own elements and tags in code are skipped, and an unknown camelCase tag fails the build naming the page and the tag.
