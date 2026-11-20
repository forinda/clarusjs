---
"clarusjs": minor
---

Typed loaders: a page's `.load.ts` can export `load({ params, request })`. It runs on the server (at build time for prerendered pages, never in the browser), and what it returns is merged into the page's inputs. `clarusjs check` checks the returned value against the page's `@input` types. A loader that throws or returns a non-object answers 500 with no internal details and logs the error (at build, the build fails naming the loader). The route manifest and `clarusjs explain` show which pages ran a loader.
