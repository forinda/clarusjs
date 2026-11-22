---
"clarusjs": minor
---

Component loaders: a `.load.ts` next to a component (outside `src/pages`) loads that component's data. Before a page renders, every component loader it uses (however deeply nested) runs in parallel with the route's context (`params`, `request`, `cookies`, `locals`), then the page renders synchronously with the results, which fill each component's inputs (props from the parent win). Static pages run them at build, server routes per request; client routes don't support them yet (an error).
