---
"clarusjs": minor
---

Data imports in templates: `@import { a, b } from './data.ts'` or `@import data from './data.json'` (a default import of anything that isn't a `.tscl` file). In components without a script the import is server-only, so build-time data and even `node:` modules stay off the browser; in islands it is bundled for the browser like a script import, and `node:` imports are a build error. `clarusjs check` types the imported values.
