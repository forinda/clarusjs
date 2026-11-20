---
"clarusjs": minor
---

Islands start from the server's state: each island's `state()` values are rendered into an `s` attribute and `attach` uses them, so initial values like `Date.now()` aren't recomputed in the browser. Island props and state are serialized with Date, Map, Set, undefined, NaN, ±Infinity, -0 and BigInt support; functions, class instances and circular references are rejected with their path (NaN and Infinity in props now round-trip instead of being rejected). Island props and state are public (they are in the page), so an island script that reads server-only globals (`process`, `Deno`, `Bun`, `require`) is a build error.
