---
'clarusjs': patch
---

A theme or other package installed by pnpm had its built stylesheet and island scripts written under `assets/node_modules/.pnpm/…`. GitHub Pages' upload skips folders starting with a dot, so on Pages the site came out unstyled. Files from a package are now named from the package (`assets/_pkg/@clarusjs/theme-docs/…`), and no built file lands in a folder starting with a dot.
