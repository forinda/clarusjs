---
'@clarusjs/content': minor
---

Every language Shiki has is highlighted with no setup: a code block's language (by name or alias, ```` ```rust ````, ```` ```py ````) is loaded from content's own Shiki the first time a page uses it. `langs` is still there for grammars of your own, or to load names up front where a typo fails the build. A language Shiki doesn't have is plain text, as before.
