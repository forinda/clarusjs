---
'clarusjs': patch
---

Types in a `.tscl` file: `@type Name<T> = …` and `@interface Name<T> extends … { … }`, for the file's `@input` props. Any TypeScript type (unions, generics with defaults, mapped and conditional types, `infer`), continuing onto following lines while a bracket is open. Erased from compiled output; checked by `clarusjs check`, with errors at their line. Local to the file: other files see them only through the component's inputs.

`@input` types and defaults can span lines too (an object type, a default object), and function types keep their `=>`: `@input onPick: (id: string) => void` (the `=` of `=>` was read as the start of a default).
