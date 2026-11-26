---
'clarusjs': patch
---

Islands with long lists attach quickly: wiring a `@for` row looks only between that row's markers. It used to search the whole island once per row, so attaching took time growing with the square of the rows (in Chromium, a form with about 2,000 fields over 80 sections took 550 ms to attach; now 136 ms).
