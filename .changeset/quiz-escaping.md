---
'@clarusjs/content': patch
---

A `::: quiz` rendered through a quiz component shows its question and options as written: `` `<script>` `` in an option now reads `<script>`, not `&lt;script&gt;`. The text was HTML-escaped into a JavaScript binding, then escaped again by the template.
