---
"@clarusjs/ui": patch
---

`ui.css` marks each part's rules with `/* part: name */` … `/* end part */` comments (no rule changes), so ui.clarusjs.com's copyable components can carry exactly the same rules, checked by a test.
