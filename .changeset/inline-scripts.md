---
"clarusjs": minor
---

`<script inline>`: a script written into the page as is (static attributes only; its content is never a template) and run where it stands, such as at the top of `<head>` to apply a saved theme before the first paint. The client router now runs the rendered page's inline head scripts, as a normal load would, and the island style is installed on the document by the loader so it survives head swaps.
