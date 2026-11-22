---
"clarusjs": patch
---

Full-document pages: a comment (or BOM) before the doctype no longer adds a second one, and `<html>`, `</head>` or `</body>` inside a `<script>` or `<style>` no longer count as the page's own tags (a page with one in an inline script got no default shell, or the loader in the wrong place).
