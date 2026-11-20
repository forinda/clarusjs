---
"clarusjs": minor
---

Dynamic routes: `src/pages/users/[id].tscl` renders `/users/<anything>`, with each `[param]` passed to the page as a string input. Static routes win over dynamic ones. A static build lists a dynamic route's pages with `entries()` exported from `[id].load.ts`; a dynamic route without it, or an entry value that is empty, `.`, `..` or contains `/`, fails the build naming the file.
