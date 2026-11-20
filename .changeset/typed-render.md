---
"clarusjs": minor
---

`render(name, props)` from `clarusjs/views`: render any view under `src/` to HTML from server code (a loader, a script importing the built server), by its path without the extension (`render('components/pill', { text })`). The server entry registers every view, and `dist/server/index.mjs` exports `render` too. `clarusjs check` writes `.clarusjs/views.d.ts`, a registry of each view's inputs, so an unknown name or a wrong prop is a type error; add it to your tsconfig's `include` for editor types.
