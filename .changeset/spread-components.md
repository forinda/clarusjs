---
'clarusjs': minor
---

Spread props onto a component with `[...]="props"`: every key is a prop, and props written on the tag win. `clarusjs check` types it against the child's inputs: the spread must provide the required inputs the tag doesn't write, with the right types.
