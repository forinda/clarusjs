---
'clarusjs': patch
---

Content mapper: a template that doesn't parse (an unclosed `@if`, `<div>` or `{{` while you type) still gives TypeScript for the rest of the file, so hover, completion and type errors keep working in the editor; the syntax error is reported as before. The build and `clarusjs check` stay strict.
