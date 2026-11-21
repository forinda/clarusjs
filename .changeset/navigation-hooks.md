---
'clarusjs': patch
---

Navigation hooks in `clarusjs/navigation`: `beforeNavigate` (can cancel), `afterNavigate` and `onNavigateError`, released with the island that registered them. A failed fragment swap or client render is now reported as `navigateerror` before the page loads normally.
