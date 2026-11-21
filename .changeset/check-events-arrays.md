---
'clarusjs': patch
---

`clarusjs check`: `$event` for an event name the DOM doesn't know (a custom event like `(rate)`) is a `CustomEvent`, so `$event.detail` checks; and `state([])` starts an array of anything instead of `never[]` (scripts are JavaScript, so there is no `state<string[]>([])`).
