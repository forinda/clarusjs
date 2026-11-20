---
"clarusjs": minor
---

`<style>` in `.tscl` files. A top-level `<style>` is the component's stylesheet, scoped with native `@scope`: the component's top-level elements get `data-cl-c="<id>"`, rules apply inside them (style the top-level element itself with `:scope`) and stop at other components. `<style global>` is left unscoped. Every component's styles are bundled into one stylesheet (minified and hashed by Vite) that every page links; in dev it is regenerated when a `.tscl` file changes. `{{ }}` holes in a component `<style>` are a located build error: pass values as CSS custom properties.
