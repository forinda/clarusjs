---
'clarusjs': patch
---

`clarusjs check` covers page sources: it reads the clarusjs plugin's `sources` (Markdown pages from `@clarusjs/content`) and `resolve.alias` from the app's Vite config. A component used in a `.md` page is checked like in a `.tscl` page, with errors at `page.md:line:col`; a page source's `.load.ts` is paired with it, and its views are in `.clarusjs/views.d.ts`. Root paths (`/src/…`) resolve as in Vite.
