---
'clarusjs': patch
---

Transitions: every page change the router or fragment navigation takes over goes through `loading` then `swapping`, shown on `<html data-cl-navigating>` for CSS. In `clarusjs/navigation`: the `navigating` store, and the in-between hooks `beforeSwap` (the next page is loaded, this one still shown) and `afterSwap` (the new page is in). Hooks may return a promise, which the page change waits for; `t.signal` aborts when a newer navigation takes over.
