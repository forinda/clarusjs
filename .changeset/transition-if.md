---
'clarusjs': minor
'@clarusjs/ai': patch
---

`@transition (name, options) { @if … }` animates an island's `@if` branches in and out with Vue's classes (`fade-enter-from`, `fade-leave-to`…; `cl-` without a name): the leaving branch stays, inert and unwired, until its animations end (or 5 s). Options: `mode` (`'out-in'`, `'in-out'`), `appear`, `duration`, `css: false` and Vue's hooks. The code is a new `clarusjs/motion` module (1.8 KB gzip) that only islands using `@transition` load; `clarusjs check` types its arguments. The AI guidance describes it.
