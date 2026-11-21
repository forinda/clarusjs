---
'@clarusjs/language-server': patch
---

Fixes from review:
- Completion no longer hangs on a lone `<`.
- Tags are found as the compiler reads them: never inside script/style bodies, comments, attribute values or Markdown code samples. Renames and references touch only real tags.
- A `<` inside a quoted value isn't a tag, and single-quoted values count as values.
- `@import` lines in `{{-- --}}` comments are ignored.
- Import aliases resolve with the build's own rules: the most specific alias first, `baseUrl`, and `jsconfig.json`. A changed config re-resolves imports already indexed, and an unreadable file no longer stops indexing.
- Tokens follow quotes and jump over script and style bodies. Holes with nested braces and multi-line generic `@input` types are read whole.
- Completing in the middle of a tag name replaces the whole name, and import path completions use `/` on Windows.
- Moving files updates importers in every workspace folder, and the batch handler is the only one. A changed file that is open in the editor keeps its unsaved text in the index.
