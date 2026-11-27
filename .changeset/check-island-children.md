---
'clarusjs': patch
---

`clarusjs check` reports a `<script server>` in a component an island renders (the build rejects it: islands re-render their children in the browser), and still accepts it under static pages.
