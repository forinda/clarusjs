---
'clarusjs': patch
---

Islands with long lists attach quickly. Wiring a `@for` row looks only between that row's markers (it searched the whole island once per row), and finding which island an element belongs to counts the slot markers before it once per list while an island attaches (it walked back over every earlier row, for each one). In Chromium, a 4,000-row list attached in 2.8 s and now in 65 ms; a form with about 2,000 fields over 80 sections went from 550 to 136 ms.
