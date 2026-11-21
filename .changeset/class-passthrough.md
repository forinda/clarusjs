---
'clarusjs': minor
---

`class="…"` on a component tag passes through to the component's top-level elements, after their own class and the scope class, so a parent's `<style scoped>` can style it (#279). Islands keep it when they re-render a block in the browser. Only a static `class` for now: `[class]` or `{{ }}` in it on a component is a located error.
