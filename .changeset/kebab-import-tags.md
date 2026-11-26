---
'clarusjs': minor
'@clarusjs/language-server': patch
---

An @imported component answers to its name in kebab case: `@import uiButton` or `@import UiButton` is `<ui-button>` too (before, `<ui-button>` silently rendered as a plain element). Only hyphenated forms: a one-word import such as `Button` never takes `<button>`. The language server's hover, go to definition, references and rename follow, keeping each tag in the case it was written.
