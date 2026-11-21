---
"clarusjs": minor
---

Components from packages: `@import x from 'some-package/x.tscl'` works like a component in `src/`. clarusjs follows `@import` lines into packages, so their islands get client chunks and their scoped styles are bundled, in dev and build. Packages that ship `.tscl` files are bundled for server rendering.
