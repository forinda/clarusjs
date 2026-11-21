---
'clarusjs': minor
---

Explicit `<style scoped>` and unique scope classes (#279).

- **Breaking:** a plain `<style>` is now global, plain CSS. Add `scoped` to keep a component's styles scoped to it. For now the compiler warns about a plain `<style>`, with its place; write `<style global>` to keep one global without the warning.
- Every component's top-level elements carry a class unique to the component (`cl-c-<name>-<hash>`), merged with their own `class`. It replaces the `data-cl-c` attribute. `cl-c-` is a reserved class prefix.
- A parent's `<style scoped>` styles a child component's top-level element (by its class or tag), but not its inside. Parent rules no longer leak into a child component that has no `<style>` of its own.
- `compile()` returns `warnings`, located `ClarusError`s that aren't thrown. The Vite plugin prints them once per file.
