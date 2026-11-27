---
'clarusjs': patch
---

`clarusjs check` also runs the compiler's own rules, so it reports what `vite build` would reject (a `<slot />` inside component content in an island, TypeScript in a template expression, and the like) at `file.tscl:line:col`. Where TypeScript already reports an error on that line, it isn't repeated.
