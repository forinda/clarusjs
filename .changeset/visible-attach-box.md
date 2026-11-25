---
'clarusjs': patch
---

`attach="visible"` attaches in real browsers: it watched `<cl-island>` itself, which is `display: contents` and so never intersects; it now watches what the island holds.
