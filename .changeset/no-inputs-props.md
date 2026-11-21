---
'clarusjs': patch
---

`clarusjs check` reports an unknown prop on a component that declares no `@input` (it was accepted silently), as it already did for components with inputs; `render()` from `clarusjs/views` checks the same.
