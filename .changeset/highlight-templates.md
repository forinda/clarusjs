---
"@clarusjs/content": minor
---

`highlightTemplates()`: a Vite plugin (add it before clarusjs) that highlights code blocks in `.tscl` templates at build time with the same Shiki setup, themes and wrapper as Markdown. Mark a block with its language: `<pre><code verbatim lang="ts">…</code></pre>`, or `<pre verbatim lang="tscl">` for a sample holding `</code>`. Blocks with `{{ }}` holes are left as written, with a build warning; clarusjs itself never loads Shiki.
