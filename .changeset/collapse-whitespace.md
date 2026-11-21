---
"clarusjs": minor
---

At `vite build`, each run of whitespace in template text becomes one character (a newline if it had one), so a formatted template's indentation stays out of the HTML. `<pre>`, `<textarea>`, `<script>`, `<style>`, `verbatim` contents and `{{ }}` values are untouched; `clarusjs({ collapseWhitespace: false })` turns it off. Also a `compile()` option, `collapseWhitespace`.
