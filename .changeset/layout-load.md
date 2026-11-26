---
'clarusjs': minor
---

`+layout.load.ts`: a folder layout's own data (#472). Its `load({ params })` returns the layout's inputs for every page it wraps, like a component's `.load.ts`. Folder and config layouts' stylesheets, components and loaders are now the page's too: a `+layout.tscl` that imports a `.css` file gets it linked on its pages.
