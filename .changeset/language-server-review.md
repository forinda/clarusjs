---
'@clarusjs/language-server': patch
---

Fixes from review:
- Moving several `.tscl` files at once updates their imports in one edit set, from their final places (no overlapping edits; two moved files that import each other stay linked).
- A file closed without saving goes back to its text on disk, so later renames and references aren't built from discarded edits.
- The deepest workspace folder holding a file is its project; folders added later are indexed; indexing no longer holds up the editor's start.
- No template completions or colours inside `<script>` and `<style>`; `@import` lines in Markdown code fences are examples, not imports.
- Block keywords are read as the compiler reads them (an email's `@if.com` isn't a block; `@else`/`@empty` only follow a block), and a `}` inside an element is text.
- A `>` inside a binding value no longer stops attribute completion; `/`-rooted specifiers stay `/`-rooted on a move, and a `~/` one leaving `src` becomes relative.
- Faster: unchanged text isn't parsed again, tsconfig lookups are cached, positions are computed once per text.
- The package no longer declares an `exports` entry: it's the `clarusjs-ls` command.
