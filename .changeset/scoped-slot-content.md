---
'clarusjs': patch
---

A component's `<style scoped>` reaches the content it passes to another component, such as a page's content inside its layout (`<docs>…</docs>`): when the component has a `<style scoped>`, the top-level elements of slot content (default and `@slot('name')`) get its scope class, as its own top-level elements do (without one, no class is added). Child components' roots keep their own class only.
