---
'clarusjs': minor
---

An island page (a page with a `<script>` or a `@model` input) gets its folder and config layouts (#472): they render around the island as server HTML, and the browser loads only the page's own code. Such a page can't fill its layouts' named slots (a located error), and in a client route it still needs `@layout none`.
