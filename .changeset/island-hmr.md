---
'clarusjs': minor
---

Island HMR in `vite dev`: saving an island's file swaps it in place with the page's new HTML and code, and its state (and that of islands inside it) carries over by name. Changes only the server sees, like pages, layouts, components without a `<script>`, loaders and Markdown pages, now reload the open page; before, the browser kept showing the old page. Builds carry none of it.
