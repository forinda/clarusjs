---
'clarusjs': patch
---

View transitions: `viewTransitions()` from `clarusjs/navigation` runs page changes (fragment swaps and client routes) inside `document.startViewTransition` where the browser has it; elsewhere they stay instant. `beforeSwap` runs before the browser's snapshot, `afterSwap` once the new page is in.
