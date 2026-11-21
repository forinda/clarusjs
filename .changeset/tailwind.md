---
"clarusjs": minor
---

Tailwind CSS v4 works with its official Vite plugin, with no extra setup. Component `<style>` blocks can start with `@reference` (for `@apply`) or `@import`. Those statements are kept outside the component's `@scope` block, and their relative paths still resolve from the component file.
