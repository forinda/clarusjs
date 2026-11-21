---
'clarusjs': patch
---

Production builds leave out the development-only `@for` duplicate-key warning (it is behind `import.meta.env?.DEV`). The package declares `sideEffects`: only the loader, router, fragment navigation and `clarusjs/navigation` run code when loaded, so bundlers drop unused runtime modules.
